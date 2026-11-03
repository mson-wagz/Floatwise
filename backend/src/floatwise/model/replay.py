from __future__ import annotations

from datetime import timedelta

import numpy as np

from floatwise.model import tools as T
from floatwise.model.grid import MAX_TOTAL_UNITS, UNIT_KSH
from floatwise.model.simulate import simulate
from floatwise.model.solver import as_simulation_policy
from floatwise.schema import TxnType

MIN_DAYS, MAX_DAYS = 7, 45
_RESTOCK_TYPES = (TxnType.cash_banking, TxnType.float_purchase)


def _schedule(txns, start, end) -> dict:
    """date -> (cash units, float units) the agent really restocked that day.
    Negative numbers are balances the agent sold or banked."""
    sched: dict = {}
    for t in txns:
        d = t.timestamp.date()
        if not (start <= d < end):
            continue
        c = f = 0
        if t.type == TxnType.cash_banking:
            c = int(round(t.amount_ksh / UNIT_KSH))
        elif t.type == TxnType.float_purchase:
            f = int(round(t.amount_ksh / UNIT_KSH))
        elif t.type == TxnType.other:
            if t.cash_delta_ksh < 0:
                c = -int(round(-t.cash_delta_ksh / UNIT_KSH))
            if t.float_delta_ksh < 0:
                f = -int(round(-t.float_delta_ksh / UNIT_KSH))
        if c or f:
            pc, pf = sched.get(d, (0, 0))
            sched[d] = (pc + c, pf + f)
    return sched


def _actual_policy(sched: dict):
    def policy(t, d, cash, flt):
        c, f = sched.get(d, (0, 0))
        zeros = np.zeros_like(cash)
        return zeros + c, zeros + f
    return policy


def _side(res, churn: float):
    rej = (res.rejected_withdrawals + res.rejected_deposits).astype(float)   # (days, paths)
    lost = res.lost_commission_ksh
    loss = churn * rej
    restock = res.restock_cost_ksh
    total = (lost + loss + restock).sum(axis=0)
    summary = {
        "expected_turned_away_customers": int(round(float(rej.sum(axis=0).mean()))),
        "expected_days_with_a_stockout": round(float((rej > 0).mean(axis=1).sum()), 1),
        "expected_lost_commission_ksh": int(round(float(lost.sum(axis=0).mean()))),
        "expected_customer_loss_ksh": int(round(float(loss.sum(axis=0).mean()))),
        "restock_cost_ksh": int(round(float(restock.sum(axis=0).mean()))),
        "total_cost_ksh": int(round(float(total.mean()))),
    }
    return summary, total, rej, restock


def replay_month(ctx, days: int = 30, n_paths: int = 4000, seed: int = 7) -> dict:
    """Estimate what running out cost the shop over the last `days` days, compared with
    following the optimal restocking plan. Needs ctx.transactions (the shop's history)."""
    if not (MIN_DAYS <= days <= MAX_DAYS):
        raise ValueError(f"days must be between {MIN_DAYS} and {MAX_DAYS}")
    if not ctx.transactions:
        raise ValueError("No transaction history yet. Confirm some SMS messages first.")

    end = ctx.today
    first = min(t.timestamp.date() for t in ctx.transactions)
    start = max(end - timedelta(days=days), first)
    n_days = (end - start).days
    if n_days < MIN_DAYS:
        raise ValueError(f"Need at least {MIN_DAYS} days of history before today to replay; "
                         f"there are {max(n_days, 0)}.")

    # Balances at the start of the window = today's balances minus everything since.
    since = [t for t in ctx.transactions if t.timestamp.date() >= start]
    cash0 = ctx.cash_ksh - sum(t.cash_delta_ksh for t in since)
    float0 = ctx.float_ksh - sum(t.float_delta_ksh for t in since)
    c0, f0 = int(round(cash0 / UNIT_KSH)), int(round(float0 / UNIT_KSH))
    if c0 < 0 or f0 < 0 or c0 + f0 > MAX_TOTAL_UNITS:
        raise ValueError(
            f"The transactions in this period do not match the current balances (they imply "
            f"KSh {cash0:,.0f} cash and KSh {float0:,.0f} float at the start). Correct the "
            f"balances or add the missing transactions, then try again.")

    churn = ctx.churn_cost_ksh
    plan = T._plan(ctx.demand, ctx.costs, churn, start, n_days + 7)
    sched = _schedule(ctx.transactions, start, end)
    common = dict(n_paths=n_paths, costs=ctx.costs, seed=seed)   # same customers in both runs
    res_a = simulate(plan.model, ctx.demand, start, n_days, c0, f0,
                     policy=_actual_policy(sched), **common)
    res_p = simulate(plan.model, ctx.demand, start, n_days, c0, f0,
                     policy=as_simulation_policy(plan), **common)

    side_a, tot_a, rej_a, _ = _side(res_a, churn)
    side_p, tot_p, rej_p, restock_p = _side(res_p, churn)

    diff = tot_a - tot_p
    saving = float(diff.mean())
    se = float(diff.std(ddof=1) / np.sqrt(diff.size))

    daily = []
    for i, d in enumerate(res_a.dates):
        c, f = sched.get(d, (0, 0))
        daily.append({
            "date": d.isoformat(), "weekday": d.strftime("%A"),
            "actual_turned_away": round(float(rej_a[i].mean()), 2),
            "plan_turned_away": round(float(rej_p[i].mean()), 2),
            "actual_restock_cash_ksh": c * UNIT_KSH, "actual_restock_float_ksh": f * UNIT_KSH,
            "plan_expected_restock_cost_ksh": int(round(float(restock_p[i].mean())))})

    return {
        "period": {"from": start.isoformat(), "to": (end - timedelta(days=1)).isoformat(),
                   "days": n_days},
        "starting_balances": {"cash_ksh": c0 * UNIT_KSH, "float_ksh": f0 * UNIT_KSH},
        "actual": side_a,
        "with_plan": side_p,
        "estimated_saving_ksh": int(round(saving)),
        "saving_range_ksh": [int(round(saving - 1.96 * se)), int(round(saving + 1.96 * se))],
        "daily": daily,
        "assumptions": {"customer_loss_per_turned_away_customer_ksh": churn,
                        "restock_costs": repr(ctx.costs)},
        "method_note": (
            "Estimated, not observed. Customers who were turned away leave no record, so this "
            "replays the period in the demand model fitted to the shop's own history. 'Actual' "
            "repeats the restocks the agent really made, on the same days; 'with plan' follows "
            "the optimal plan. The customer-loss cost is an assumption. The range shows "
            "simulation noise only, not uncertainty in demand or costs."),
    }
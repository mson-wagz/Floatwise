from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import date, timedelta

import numpy as np

from floatwise.model.costs import RestockCosts
from floatwise.model.demand import DAY_NAMES, ShopDemand
from floatwise.model.grid import MAX_TOTAL_UNITS, UNIT_KSH, build_state_space
from floatwise.model.kernel import build_event_model, end_of_day_distribution
from floatwise.model.risk import p_stockout_no_restock
from floatwise.model.solver import RestockOption, solve, trace

STOCKOUT_DEFINITION = "at least one customer turned away"


@dataclass
class ShopContext:
    """Everything the tools need to know about one shop, as of one morning."""
    demand: ShopDemand
    cash_ksh: int
    float_ksh: int
    today: date
    costs: RestockCosts = field(default_factory=RestockCosts)
    churn_cost_ksh: float = 150.0   # ASSUMPTION: cost of each customer turned away


# ---- caches: building the model and solving take seconds, so reuse them ----
_SPACE = None
_MODELS: dict = {}
_PLANS: dict = {}


def _space():
    global _SPACE
    if _SPACE is None:
        _SPACE = build_state_space()
    return _SPACE


def _put(cache: dict, key, value, limit: int = 8):
    if len(cache) >= limit:
        cache.pop(next(iter(cache)))
    cache[key] = value
    return value


def _model(demand: ShopDemand, churn: float):
    key = (repr(demand), churn)
    if key not in _MODELS:
        _put(_MODELS, key, build_event_model(demand.size_pmf(), _space(), churn))
    return _MODELS[key]


def _plan(demand, costs, churn, start: date, horizon: int):
    key = (repr(demand), repr(costs), churn, start.isoformat(), horizon)
    if key not in _PLANS:
        _put(_PLANS, key, solve(_model(demand, churn), demand, start, horizon, costs))
    return _PLANS[key]


# ---- helpers ----
def _units(ctx: ShopContext) -> tuple[int, int]:
    c = int(round(ctx.cash_ksh / UNIT_KSH))
    f = int(round(ctx.float_ksh / UNIT_KSH))
    if c < 0 or f < 0 or c + f > MAX_TOTAL_UNITS:
        raise ValueError("balances must be non-negative and total at most "
                         f"KSh {MAX_TOTAL_UNITS * UNIT_KSH:,}")
    return c, f


def _clamp_add(opt: RestockOption, cash_ksh: float, float_ksh: float) -> tuple[int, int]:
    """Amounts (KSh) that actually fit: cash + float can never exceed the capacity."""
    c = int(round(cash_ksh / UNIT_KSH))
    f = int(round(float_ksh / UNIT_KSH))
    room = max(MAX_TOTAL_UNITS - (c + f), 0)
    add_c = min(opt.cash_units, room)
    add_f = min(opt.float_units, room - add_c)
    return add_c * UNIT_KSH, add_f * UNIT_KSH


def _restock(day: date, idx: int, add_c: int, add_f: int, p_before: float, p_plan: float):
    if add_c + add_f == 0:
        return None
    kind = "both" if add_c and add_f else ("cash" if add_c else "float")
    return {"date": day.isoformat(), "weekday": day.strftime("%A"), "day_index": idx,
            "kind": kind, "add_cash_ksh": int(add_c), "add_float_ksh": int(add_f),
            "p_stockout_before": round(float(p_before), 4),
            "p_plan_restocks_this_day": round(float(p_plan), 4)}


def _quantile_ksh(pmf: np.ndarray, q: float) -> int:
    cdf = np.cumsum(pmf)
    i = int(min(np.searchsorted(cdf, q * cdf[-1]), len(pmf) - 1))
    return i * UNIT_KSH


# ---- the tools the agent will call ----
def get_recommendation(ctx: ShopContext, horizon_days: int = 14) -> dict:
    """When and how much to restock, from the exact optimal plan.

    If the plan says to restock this morning, the answer uses the REAL balances.
    Otherwise the restock day is the first morning by which the plan has probably
    already restocked at least once (cumulative probability >= 50%), and the amount
    is the plan's usual choice that day, clamped to the room that is free.
    """
    c0, f0 = _units(ctx)
    plan = _plan(ctx.demand, ctx.costs, ctx.churn_cost_ksh, ctx.today, horizon_days)
    space = plan.model.space
    risk = p_stockout_no_restock(plan.model, ctx.demand, ctx.today, horizon_days, c0, f0)
    rows = trace(plan, c0, f0)

    restock = None
    a0 = int(plan.policy[0][space.index[c0, f0]])
    if a0 != 0:   # the plan says act this morning, using the real balances
        add_c, add_f = _clamp_add(plan.menu[a0], ctx.cash_ksh, ctx.float_ksh)
        restock = _restock(ctx.today, 0, add_c, add_f, 0.0, 1.0)
        if restock is not None:
            restock["p_plan_restocks_by_then"] = 1.0
    else:
        cum, hit = 0.0, None
        for i, r in enumerate(rows):
            cum += r["p_restock"]
            if cum >= 0.5:
                hit = i
                break
        if hit is not None:
            mc = ctx.cash_ksh if hit == 0 else rows[hit - 1]["mean_cash_ksh"]
            mf = ctx.float_ksh if hit == 0 else rows[hit - 1]["mean_float_ksh"]
            add_c, add_f = _clamp_add(rows[hit]["top_option"], mc, mf)
            restock = _restock(ctx.today + timedelta(days=hit), hit, add_c, add_f,
                               risk[hit - 1] if hit > 0 else 0.0, rows[hit]["p_restock"])
            if restock is not None:
                # Approximate: a path could restock more than once, so this slightly
                # overstates the chance. Present it as "likely by".
                restock["p_plan_restocks_by_then"] = round(min(cum, 1.0), 4)

    return {
        "as_of": ctx.today.isoformat(),
        "balances": {"cash_ksh": ctx.cash_ksh, "float_ksh": ctx.float_ksh},
        "restock": restock,   # None = no restock needed within the horizon
        "p_stockout_by_day_no_restock": [round(float(x), 4) for x in risk],
        "stockout_definition": STOCKOUT_DEFINITION,
        "expected_cost_ksh": int(round(plan.value(c0, f0))),
        "assumptions": {"churn_cost_per_turned_away_customer_ksh": ctx.churn_cost_ksh,
                        "restock_costs": repr(ctx.costs)},
        "evidence": {"method": "exact backward induction", "horizon_days": horizon_days},
    }


def get_forecast(ctx: ShopContext, horizon_days: int = 7) -> dict:
    """Balance ranges and stockout risk if the shop does NOT restock."""
    c0, f0 = _units(ctx)
    model = _model(ctx.demand, ctx.churn_cost_ksh)
    space = model.space
    risk = p_stockout_no_restock(model, ctx.demand, ctx.today, horizon_days, c0, f0)
    mu = np.zeros(space.n)
    mu[space.index[c0, f0]] = 1.0
    days = []
    for t in range(horizon_days):
        d = ctx.today + timedelta(days=t)
        mu = end_of_day_distribution(model, ctx.demand.day_params(d), mu)
        cp = np.bincount(space.cash, weights=mu, minlength=space.cap + 1)
        fp = np.bincount(space.float_, weights=mu, minlength=space.cap + 1)
        days.append({
            "date": d.isoformat(), "weekday": d.strftime("%A"),
            "cash_p10_ksh": _quantile_ksh(cp, 0.1), "cash_p50_ksh": _quantile_ksh(cp, 0.5),
            "cash_p90_ksh": _quantile_ksh(cp, 0.9),
            "float_p10_ksh": _quantile_ksh(fp, 0.1), "float_p50_ksh": _quantile_ksh(fp, 0.5),
            "float_p90_ksh": _quantile_ksh(fp, 0.9),
            "p_stockout_by_this_day": round(float(risk[t]), 4)})
    return {"as_of": ctx.today.isoformat(), "scenario": "no restocking",
            "stockout_definition": STOCKOUT_DEFINITION, "days": days}


def run_whatif(ctx: ShopContext, market_day: str | None = None,
               demand_multiplier: float | None = None, events: list[dict] | None = None,
               horizon_days: int = 14) -> dict:
    """Change the demand assumptions, re-solve, and compare with the baseline.

    events: [{"date": "2026-11-02", "multiplier": 1.8, "label": "school fees"}]
    """
    demand = ctx.demand
    changed = []
    if market_day:
        name = market_day.strip().lower()
        if name not in DAY_NAMES:
            raise ValueError(f"unknown day: {market_day}")
        demand = replace(demand, market_days=tuple(sorted(set(demand.market_days) | {name})))
        changed.append(f"{name} treated as a market day")
    if demand_multiplier is not None:
        demand = replace(demand, demand_multiplier=demand.demand_multiplier * demand_multiplier)
        changed.append(f"overall demand x{demand_multiplier}")
    if events:
        extra = []
        for e in events:
            iso = date.fromisoformat(e["date"]).isoformat()
            extra.append((iso, float(e["multiplier"])))
            changed.append(f"{e.get('label', 'event')} on {iso}: demand x{e['multiplier']}")
        demand = replace(demand, event_mults=demand.event_mults + tuple(extra))

    base = get_recommendation(ctx, horizon_days)
    scen = get_recommendation(replace(ctx, demand=demand), horizon_days)
    return {
        "baseline": base, "scenario": scen, "assumptions_changed": changed,
        "delta": {
            "expected_cost_ksh": scen["expected_cost_ksh"] - base["expected_cost_ksh"],
            "p_stockout_at_horizon_no_restock": round(
                scen["p_stockout_by_day_no_restock"][-1]
                - base["p_stockout_by_day_no_restock"][-1], 4)}}
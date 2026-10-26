from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np

from floatwise.model.costs import RestockCosts
from floatwise.model.demand import ShopDemand
from floatwise.model.grid import UNIT_KSH, apply_restock
from floatwise.model.kernel import EventModel, day_value, end_of_day_distribution
from floatwise.model.risk import p_stockout_no_restock


@dataclass(frozen=True)
class RestockOption:
    cash_units: int     # units of KSh 1,000
    float_units: int


# Index 0 is (0, 0) = wait. Ties always resolve to waiting.
DEFAULT_MENU = tuple(RestockOption(c, f) for c in (0, 20, 50, 100) for f in (0, 20, 50, 100))


@dataclass(eq=False)
class Plan:
    model: EventModel
    demand: ShopDemand
    costs: RestockCosts
    start: date
    horizon: int
    menu: tuple
    post_idx: np.ndarray   # (options, states): state reached after restocking
    r_cost: np.ndarray     # (options, states): restock cost in KSh
    V: list                # V[t][state] = minimum expected cost from day t on
    policy: list           # policy[t][state] = index of the best option

    def value(self, cash_units: int, float_units: int) -> float:
        return float(self.V[0][self.model.space.index[cash_units, float_units]])


def solve(model: EventModel, demand: ShopDemand, start: date, horizon: int,
          costs: RestockCosts | None = None, menu: tuple = DEFAULT_MENU) -> Plan:
    """Exact backward induction. Each morning: choose a restock option; then the day
    plays out under the exact kernel. Cost = restock cost + expected lost commission
    + churn cost. Use a horizon longer than the decisions you will act on (the last
    days see no future, so ignore advice near the end)."""
    costs = costs or RestockCosts()
    space = model.space
    n, A = space.n, len(menu)

    post_idx = np.empty((A, n), dtype=np.int64)
    r_cost = np.empty((A, n))
    for a, opt in enumerate(menu):
        nc, nf = apply_restock(space.cash, space.float_,
                               np.full(n, opt.cash_units), np.full(n, opt.float_units),
                               space.cap)
        post_idx[a] = space.index[nc, nf]
        r_cost[a] = costs.cost(nc - space.cash, nf - space.float_)

    V = [None] * (horizon + 1)
    V[horizon] = np.zeros(n)
    policy = [None] * horizon
    for t in range(horizon - 1, -1, -1):
        day = demand.day_params(start + timedelta(days=t))
        W = day_value(model, day, V[t + 1])          # same for every action
        Q = r_cost + W[post_idx]                     # (options, states)
        policy[t] = Q.argmin(axis=0)
        V[t] = Q.min(axis=0)

    return Plan(model, demand, costs, start, horizon, menu, post_idx, r_cost, V, policy)


def evaluate_policy(plan: Plan, policy: list) -> np.ndarray:
    """Exact expected cost of following any fixed policy (list of per-day arrays)."""
    ar = np.arange(plan.model.space.n)
    V = np.zeros(plan.model.space.n)
    for t in range(plan.horizon - 1, -1, -1):
        day = plan.demand.day_params(plan.start + timedelta(days=t))
        W = day_value(plan.model, day, V)
        a = policy[t]
        V = plan.r_cost[a, ar] + W[plan.post_idx[a, ar]]
    return V


def as_simulation_policy(plan: Plan):
    """Wrap the plan so simulate() can run it, to cross-check against Monte Carlo."""
    space = plan.model.space
    add_c = np.array([o.cash_units for o in plan.menu])
    add_f = np.array([o.float_units for o in plan.menu])

    def policy(t, d, cash, flt):
        a = plan.policy[t][space.index[cash, flt]]
        return add_c[a], add_f[a]
    return policy


def trace(plan: Plan, init_cash: int, init_float: int) -> list[dict]:
    """Exact day-by-day picture if the shop follows the optimal plan."""
    space = plan.model.space
    n, A = space.n, len(plan.menu)
    ar = np.arange(n)
    mu = np.zeros(n)
    mu[space.index[init_cash, init_float]] = 1.0
    rows = []
    for t in range(plan.horizon):
        d = plan.start + timedelta(days=t)
        a = plan.policy[t]
        mass = np.bincount(a, weights=mu, minlength=A)
        p_restock = float(mass[1:].sum())
        top = int(np.argmax(mass[1:])) + 1 if p_restock > 0 else 0
        exp_cost = float((mu * plan.r_cost[a, ar]).sum())
        post = np.bincount(plan.post_idx[a, ar], weights=mu, minlength=n)
        mu = end_of_day_distribution(plan.model, plan.demand.day_params(d), post)
        rows.append({
            "date": d.isoformat(),
            "p_restock": p_restock,
            "top_option": plan.menu[top],
            "expected_restock_cost_ksh": exp_cost,
            "mean_cash_ksh": float((mu * space.cash).sum() * UNIT_KSH),
            "mean_float_ksh": float((mu * space.float_).sum() * UNIT_KSH),
        })
    return rows


def recommend(plan: Plan, init_cash: int, init_float: int, trigger: float = 0.5) -> dict:
    """Restock day = first day the optimal plan restocks with probability >= trigger.
    The risk quoted is the exact chance a customer is turned away BEFORE that morning
    if the shop does nothing until then."""
    rows = trace(plan, init_cash, init_float)
    risk = p_stockout_no_restock(plan.model, plan.demand, plan.start, plan.horizon,
                                 init_cash, init_float)
    base = {"p_stockout_by_day_no_restock": risk.tolist(),
            "expected_cost_ksh": plan.value(init_cash, init_float), "trace": rows}
    hit = next((i for i, r in enumerate(rows) if r["p_restock"] >= trigger), None)
    if hit is None:
        return {"restock": False, **base}
    opt = rows[hit]["top_option"]
    return {
        "restock": True,
        "restock_date": rows[hit]["date"],
        "day_index": hit,
        "add_cash_ksh": opt.cash_units * UNIT_KSH,
        "add_float_ksh": opt.float_units * UNIT_KSH,
        "p_stockout_before_restock": 0.0 if hit == 0 else float(risk[hit - 1]),
        **base,
    }
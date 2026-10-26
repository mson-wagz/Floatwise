from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable

import numpy as np

from floatwise.model.costs import RestockCosts
from floatwise.model.demand import ShopDemand
from floatwise.model.grid import apply_restock
from floatwise.model.kernel import EventModel

Policy = Callable[[int, date, np.ndarray, np.ndarray], tuple]


def never_restock(t, d, cash, flt):
    z = np.zeros_like(cash)
    return z, z


def threshold_policy(cash_below: int, cash_to: int, float_below: int, float_to: int) -> Policy:
    """Restock in the morning when a balance is under its trigger (units)."""
    def policy(t, d, cash, flt):
        return (np.where(cash < cash_below, cash_to - cash, 0),
                np.where(flt < float_below, float_to - flt, 0))
    return policy


@dataclass
class SimResult:
    dates: list
    cash_end: np.ndarray             # (days, paths), units
    float_end: np.ndarray
    rejected_withdrawals: np.ndarray  # customers turned away for lack of cash
    rejected_deposits: np.ndarray     # customers turned away for lack of float
    lost_commission_ksh: np.ndarray
    restock_cost_ksh: np.ndarray

    def p_stockout_by_day(self) -> np.ndarray:
        """P(at least one customer turned away on or before each day)."""
        any_rej = (self.rejected_withdrawals + self.rejected_deposits) > 0
        return (np.cumsum(any_rej, axis=0) > 0).mean(axis=1)

    def summary(self) -> dict:
        lost = self.lost_commission_ksh.sum(axis=0)
        cost = self.restock_cost_ksh.sum(axis=0)
        return {
            "days": len(self.dates),
            "mean_lost_commission_ksh": float(lost.mean()),
            "mean_restock_cost_ksh": float(cost.mean()),
            "mean_total_cost_ksh": float((lost + cost).mean()),
            "p_stockout_by_day": [round(float(x), 3) for x in self.p_stockout_by_day()],
        }


def simulate(model: EventModel, demand: ShopDemand, start: date, days: int,
             init_cash: int, init_float: int, n_paths: int = 10_000,
             policy: Policy = never_restock, costs: RestockCosts | None = None,
             seed: int = 0) -> SimResult:
    costs = costs or RestockCosts()
    space = model.space
    if init_cash < 0 or init_float < 0 or init_cash + init_float > space.cap:
        raise ValueError("starting balances outside the state space")

    rng = np.random.default_rng(seed)
    K = len(model.pmf) - 1
    cdf = np.cumsum(model.pmf)

    cash = np.full(n_paths, init_cash, dtype=np.int64)
    flt = np.full(n_paths, init_float, dtype=np.int64)
    shape = (days, n_paths)
    cash_end, float_end = np.zeros(shape, np.int64), np.zeros(shape, np.int64)
    rej_w_all, rej_d_all = np.zeros(shape, np.int64), np.zeros(shape, np.int64)
    lost_all, restock_all = np.zeros(shape), np.zeros(shape)

    for t in range(days):
        d = start + timedelta(days=t)
        day = demand.day_params(d)

        # Morning: restock decision.
        add_c, add_f = policy(t, d, cash, flt)
        new_cash, new_flt = apply_restock(cash, flt, add_c, add_f, space.cap)
        restock_all[t] = costs.cost(new_cash - cash, new_flt - flt)
        cash, flt = new_cash, new_flt

        # Customers arrive one at a time; paths run side by side.
        n_events = rng.poisson(day.events_mean, size=n_paths)
        rej_w = np.zeros(n_paths, np.int64)
        rej_d = np.zeros(n_paths, np.int64)
        lost = np.zeros(n_paths)

        for j in range(int(n_events.max())):
            active = n_events > j
            is_w = rng.random(n_paths) < day.p_withdrawal
            size = np.minimum(np.searchsorted(cdf, rng.random(n_paths), side="right"), K)

            w = active & is_w
            dep = active & ~is_w
            bad_w = w & (size > cash)
            bad_d = dep & (size > flt)
            ok_w = w & ~bad_w
            ok_d = dep & ~bad_d

            cash = cash - np.where(ok_w, size, 0) + np.where(ok_d, size, 0)
            flt = flt + np.where(ok_w, size, 0) - np.where(ok_d, size, 0)
            rej_w += bad_w
            rej_d += bad_d
            lost += np.where(bad_w, model.comm_w[size], 0.0) \
                  + np.where(bad_d, model.comm_d[size], 0.0)

        cash_end[t], float_end[t] = cash, flt
        rej_w_all[t], rej_d_all[t], lost_all[t] = rej_w, rej_d, lost

    return SimResult([start + timedelta(days=t) for t in range(days)],
                     cash_end, float_end, rej_w_all, rej_d_all, lost_all, restock_all)
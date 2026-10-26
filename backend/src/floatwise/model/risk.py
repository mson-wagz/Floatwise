from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from floatwise.model.demand import ShopDemand
from floatwise.model.kernel import EventModel, event_count_pmf


def p_stockout_no_restock(model: EventModel, demand: ShopDemand, start: date,
                          days: int, init_cash: int, init_float: int) -> np.ndarray:
    """Exact P(at least one customer has been turned away by the end of each day),
    if the shop does no restocking. This is the "chance you run out before then"."""
    space = model.space
    v = np.zeros(space.n)
    v[space.index[init_cash, init_float]] = 1.0   # mass of paths with no turn-away yet
    out = []
    for t in range(days):
        day = demand.day_params(start + timedelta(days=t))
        p = day.p_withdrawal
        MT = (p * model.Mw_ok + (1 - p) * model.Md_ok).T.tocsr()
        pi = event_count_pmf(day.events_mean)
        acc = pi[0] * v
        w = v
        for n in range(1, len(pi)):
            w = MT @ w
            acc = acc + pi[n] * w
        v = acc
        out.append(1.0 - float(v.sum()))
    return np.array(out)
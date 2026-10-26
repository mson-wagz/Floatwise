from __future__ import annotations

from datetime import timedelta

import numpy as np

from floatwise.model.demand import DAY_NAMES, ShopDemand
from floatwise.schema import Transaction, TxnType


def _is_payday(d, payday_dates) -> bool:
    return any(0 <= d.day - pd <= 1 for pd in payday_dates)


def fit_demand(txns: list[Transaction], market_days=("saturday",),
               payday_dates=(25, 30), min_days: int = 3) -> tuple[ShopDemand, dict]:
    """Estimate a shop's demand pattern from its transaction history.

    LIMITATION: the history only contains customers who were SERVED. On days the shop
    ran out, demand is under-counted, so the fit is biased low. Say so in the app.
    Patterns with fewer than `min_days` observed days fall back to defaults.
    """
    cust = [t for t in txns if t.type in (TxnType.withdrawal, TxnType.deposit)]
    if len(cust) < 30:
        raise ValueError("need at least 30 customer transactions to fit demand")

    first = min(t.timestamp.date() for t in cust)
    last = max(t.timestamp.date() for t in cust)
    n_days = (last - first).days + 1
    days = [first + timedelta(days=i) for i in range(n_days)]
    count = {d: 0 for d in days}
    wd = {d: 0 for d in days}
    for t in cust:
        d = t.timestamp.date()
        count[d] += 1
        wd[d] += int(t.type == TxnType.withdrawal)

    market = set(market_days)

    def kind(d):
        if DAY_NAMES[d.weekday()] in market:
            return "market"
        return "payday" if _is_payday(d, payday_dates) else "plain"

    plain = [d for d in days if kind(d) == "plain"]
    base_days = plain if len(plain) >= min_days else days
    base = max(float(np.mean([count[d] for d in base_days])), 1.0)
    total_base = sum(count[d] for d in base_days)
    p_plain = sum(wd[d] for d in base_days) / max(total_base, 1)

    dow = {}
    for i, name in enumerate(DAY_NAMES):
        ds = [d for d in plain if d.weekday() == i]
        dow[name] = (max(float(np.mean([count[d] for d in ds])) / base, 0.05)
                     if len(ds) >= min_days else 1.0)

    def ratio(ds):
        return float(np.mean([count[d] / (base * dow[DAY_NAMES[d.weekday()]]) for d in ds]))

    mk = [d for d in days if kind(d) == "market"]
    pdays = [d for d in days if kind(d) == "payday"]
    market_mult = ratio(mk) if len(mk) >= min_days else 1.4
    payday_mult = ratio(pdays) if len(pdays) >= min_days else 1.5
    if len(pdays) >= min_days:
        p_pay = sum(wd[d] for d in pdays) / max(sum(count[d] for d in pdays), 1)
        shift = float(np.clip(p_pay - p_plain, 0.0, 0.3))
    else:
        shift = 0.10

    amounts = np.array([t.amount_ksh for t in cust], dtype=float)
    size_mean = float(amounts.mean())
    size_cv = float(np.clip(amounts.std() / size_mean, 0.3, 2.0))

    demand = ShopDemand(
        base_events_per_day=base,
        p_withdrawal=float(np.clip(p_plain, 0.05, 0.95)),
        size_mean_ksh=size_mean, size_cv=size_cv, dow_mult=dow,
        market_days=tuple(market_days), market_mult=market_mult,
        payday_dates=tuple(payday_dates), payday_mult=payday_mult,
        payday_p_shift=shift)
    info = {"n_days": n_days, "n_customer_txns": len(cust),
            "plain_days": len(plain), "market_days_seen": len(mk),
            "payday_days_seen": len(pdays),
            "note": "Served customers only; demand is under-counted on stockout days."}
    return demand, info
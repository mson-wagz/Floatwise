from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np

from floatwise.schema import Source, Transaction, TxnType, apply_deltas
from floatwise.economics import commission_ksh


TZ = ZoneInfo("Africa/Nairobi")
HOURS = np.arange(7, 21)  # shop open 07:00 to 20:59
HOUR_WEIGHTS = np.array([2, 4, 5, 5, 6, 8, 8, 6, 5, 5, 6, 7, 5, 3], dtype=float)
HOUR_WEIGHTS /= HOUR_WEIGHTS.sum()

DOW_MULT = {"monday": 0.9, "tuesday": 0.9, "wednesday": 0.95, "thursday": 1.0,
            "friday": 1.2, "saturday": 1.1, "sunday": 0.8}


def commission(amount: int, kind: TxnType) -> int:
    return commission_ksh(amount, kind == TxnType.withdrawal)


@dataclass
class SynthProfile:
    name: str = "Mama Njeri Agency"
    base_withdrawals: float = 35.0   # customers per average day
    base_deposits: float = 14.0
    market_days: list[str] = field(default_factory=lambda: ["saturday"])
    payday_dates: list[int] = field(default_factory=lambda: [25, 30])
    cash_target: int = 150_000
    float_target: int = 150_000
    restock_check_prob: float = 0.4   # chance the agent "feels" it is time
    restock_trigger: float = 0.25     # restock only if below this share of target


@dataclass
class SynthResult:
    transactions: list[Transaction]
    missed: list[dict]
    opening_cash: int
    opening_float: int
    profile: SynthProfile


def _day_multipliers(d: date, p: SynthProfile) -> tuple[float, float]:
    dow = d.strftime("%A").lower()
    w = d_mult = DOW_MULT[dow]
    if dow in p.market_days:
        w *= 1.5
        d_mult *= 1.2
    near_payday = any(0 <= (d.day - pd) <= 1 for pd in p.payday_dates)
    if near_payday:
        w *= 1.5
    return w, d_mult


def _amount(rng: np.random.Generator) -> int:
    raw = rng.lognormal(mean=np.log(2500), sigma=0.9)
    return int(min(max(round(raw / 50) * 50, 100), 70_000))


def generate(profile: SynthProfile, start: date, days: int, seed: int = 42) -> SynthResult:
    rng = np.random.default_rng(seed)
    cash, flt = profile.cash_target, profile.float_target
    opening_cash, opening_float = cash, flt
    txns: list[Transaction] = []
    missed: list[dict] = []

    def add(ts: datetime, kind: TxnType, amount: int, cust: int | None) -> None:
        dc, df = apply_deltas(kind, amount)
        txns.append(Transaction(
            id=f"txn_{len(txns):06d}", timestamp=ts, type=kind, amount_ksh=amount,
            commission_ksh=commission(amount, kind) if cust is not None else 0,
            cash_delta_ksh=dc, float_delta_ksh=df,
            counterparty_hash=f"{cust:06x}" if cust is not None else None,
            source=Source.synthetic))

    for i in range(days):
        d = start + timedelta(days=i)
        w_mult, d_mult = _day_multipliers(d, profile)

        # Agent restocks "by feel": only some mornings, only if clearly low.
        morning = datetime(d.year, d.month, d.day, 7, 0, tzinfo=TZ)
        if rng.random() < profile.restock_check_prob:
            if cash < profile.restock_trigger * profile.cash_target:
                amt = int(round((profile.cash_target - cash) / 1000) * 1000)
                if amt > 0:
                    add(morning, TxnType.cash_banking, amt, None)
                    cash += amt
            if flt < profile.restock_trigger * profile.float_target:
                amt = int(round((profile.float_target - flt) / 1000) * 1000)
                if amt > 0:
                    add(morning, TxnType.float_purchase, amt, None)
                    flt += amt

        n_w = rng.poisson(profile.base_withdrawals * w_mult)
        n_d = rng.poisson(profile.base_deposits * d_mult)
        events = [(TxnType.withdrawal, None)] * n_w + [(TxnType.deposit, None)] * n_d
        timed = []
        for kind, _ in events:
            hour = int(rng.choice(HOURS, p=HOUR_WEIGHTS))
            minute = int(rng.integers(0, 60))
            timed.append((hour, minute, kind))
        timed.sort()

        for hour, minute, kind in timed:
            ts = datetime(d.year, d.month, d.day, hour, minute, tzinfo=TZ)
            amount = _amount(rng)
            cust = int(rng.integers(0, 400))
            # A withdrawal needs cash in the till; a deposit needs e-float.
            if kind == TxnType.withdrawal and amount > cash:
                missed.append({"timestamp": ts.isoformat(), "kind": "cash",
                               "amount_ksh": amount,
                               "lost_commission_ksh": commission(amount, kind)})
                continue
            if kind == TxnType.deposit and amount > flt:
                missed.append({"timestamp": ts.isoformat(), "kind": "float",
                               "amount_ksh": amount,
                               "lost_commission_ksh": commission(amount, kind)})
                continue
            add(ts, kind, amount, cust)
            dc, df = apply_deltas(kind, amount)
            cash += dc
            flt += df

    return SynthResult(txns, missed, opening_cash, opening_float, profile)


def save(result: SynthResult, path: str) -> None:
    payload = {
        "shop": result.profile.name,
        "opening": {"cash_ksh": result.opening_cash, "float_ksh": result.opening_float},
        "transactions": [t.model_dump(mode="json") for t in result.transactions],
        "missed_demand": result.missed,
    }
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
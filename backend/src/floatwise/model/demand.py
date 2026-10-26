from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date

import numpy as np
from scipy.stats import lognorm

from floatwise.model.grid import MAX_TXN_UNITS, UNIT_KSH

DAY_NAMES = ("monday", "tuesday", "wednesday", "thursday",
             "friday", "saturday", "sunday")
DEFAULT_DOW_MULT = {"monday": 0.9, "tuesday": 0.9, "wednesday": 0.95,
                    "thursday": 1.0, "friday": 1.2, "saturday": 1.1, "sunday": 0.8}


@dataclass(frozen=True)
class DayParams:
    events_mean: float     # expected number of customers that day
    p_withdrawal: float    # chance a customer wants cash out


@dataclass(frozen=True)
class ShopDemand:
    """All numbers here are ASSUMPTIONS until fitted to a real shop's data."""
    base_events_per_day: float = 40.0
    p_withdrawal: float = 0.5
    size_mean_ksh: float = 3_000.0
    size_cv: float = 1.0
    dow_mult: dict = field(default_factory=lambda: dict(DEFAULT_DOW_MULT))
    market_days: tuple = ("saturday",)
    market_mult: float = 1.4
    payday_dates: tuple = (25, 30)
    payday_mult: float = 1.5
    payday_p_shift: float = 0.10     # more people cash out their pay
    demand_multiplier: float = 1.0   # what-if lever
    event_mults: tuple = ()          # one-off spikes, e.g. (("2026-11-02", 1.8),)

    def day_params(self, d: date) -> DayParams:
        name = DAY_NAMES[d.weekday()]
        mult = self.dow_mult[name]
        p = self.p_withdrawal
        if name in self.market_days:
            mult *= self.market_mult
        if any(0 <= d.day - pd <= 1 for pd in self.payday_dates):
            mult *= self.payday_mult
            p += self.payday_p_shift
        for iso, m in self.event_mults:
            if iso == d.isoformat():
                mult *= m
        p = min(max(p, 0.05), 0.95)
        return DayParams(self.base_events_per_day * mult * self.demand_multiplier, p)

    def size_pmf(self) -> np.ndarray:
        return size_pmf(self.size_mean_ksh, self.size_cv)


def size_pmf(mean_ksh: float, cv: float, max_units: int = MAX_TXN_UNITS) -> np.ndarray:
    """Log-normal transaction size on the unit grid, with mean preserved.

    Each continuous amount x is split between floor(x) and floor(x)+1 in
    proportion to its position, so the mean in shillings is not distorted.
    Index k = k units; index 0 is a transaction too small to move the balance.
    Mass above max_units is dropped and the rest renormalised.
    """
    mean_u = mean_ksh / UNIT_KSH
    sigma = math.sqrt(math.log(1 + cv ** 2))
    mu = math.log(mean_u) - sigma ** 2 / 2
    dist = lognorm(s=sigma, scale=math.exp(mu))

    n = 40_000
    dx = max_units / n
    x = (np.arange(n) + 0.5) * dx
    mass = dist.pdf(x) * dx
    k = np.floor(x).astype(int)
    frac = x - k
    pmf = (np.bincount(k, weights=mass * (1 - frac), minlength=max_units + 1)
           + np.bincount(k + 1, weights=mass * frac, minlength=max_units + 1))
    return pmf / pmf.sum()
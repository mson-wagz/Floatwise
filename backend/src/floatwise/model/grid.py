from __future__ import annotations

from dataclasses import dataclass

import numpy as np

UNIT_KSH = 1_000          # one grid unit
MAX_TOTAL_UNITS = 150     # cash + float never exceeds KSh 150,000
MAX_TXN_UNITS = 40        # largest single transaction modelled: KSh 40,000


@dataclass(eq=False)
class StateSpace:
    """All (cash, float) pairs with cash + float <= cap, in units."""
    cap: int
    cash: np.ndarray
    float_: np.ndarray
    index: np.ndarray   # (cap+1, cap+1) -> state number, or -1 if outside

    @property
    def n(self) -> int:
        return int(self.cash.size)


def build_state_space(cap: int = MAX_TOTAL_UNITS) -> StateSpace:
    c, f = np.meshgrid(np.arange(cap + 1), np.arange(cap + 1), indexing="ij")
    mask = (c + f) <= cap
    cash, flt = c[mask], f[mask]
    index = np.full((cap + 1, cap + 1), -1, dtype=np.int64)
    index[cash, flt] = np.arange(cash.size)
    return StateSpace(cap, cash, flt, index)


def apply_restock(cash, flt, add_cash, add_float, cap: int = MAX_TOTAL_UNITS):
    """Add cash and/or float, clamped so cash + float <= cap. Works on arrays."""
    room = cap - (cash + flt)
    add_cash = np.minimum(np.maximum(add_cash, 0), room)
    add_float = np.minimum(np.maximum(add_float, 0), room - add_cash)
    return cash + add_cash, flt + add_float
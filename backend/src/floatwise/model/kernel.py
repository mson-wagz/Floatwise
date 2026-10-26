from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.sparse import coo_matrix, csr_matrix
from scipy.stats import poisson

from floatwise.economics import commission_ksh
from floatwise.model.demand import DayParams
from floatwise.model.grid import UNIT_KSH, StateSpace


@dataclass(eq=False)
class EventModel:
    """What one customer event does, for every state.

    Mw / Md: transition matrices for one withdrawal / one deposit event.
    A rejected customer leaves the state unchanged (a self-loop) and costs
    the lost commission (plus churn), held in rej_cost_*.
    Mw_ok / Md_ok: same, but a rejected customer removes probability mass,
    so repeated multiplication tracks paths with NO rejection so far.
    """
    space: StateSpace
    pmf: np.ndarray
    comm_w: np.ndarray
    comm_d: np.ndarray
    Mw: csr_matrix
    Md: csr_matrix
    rej_cost_w: np.ndarray
    rej_cost_d: np.ndarray
    Mw_ok: csr_matrix
    Md_ok: csr_matrix


def _tail_sums(values: np.ndarray, cap: int) -> np.ndarray:
    """out[b] = sum of values[k] for k > b, for b = 0..cap."""
    rev = np.cumsum(values[::-1])[::-1]
    tail = np.append(rev[1:], 0.0)
    out = np.zeros(cap + 1)
    m = min(len(tail), cap + 1)
    out[:m] = tail[:m]
    return out


def _move_matrix(space: StateSpace, pmf: np.ndarray, withdrawal: bool,
                 keep_rejected: bool = True) -> csr_matrix:
    K = len(pmf) - 1
    bal = space.cash if withdrawal else space.float_
    cdf = np.cumsum(pmf)
    n = space.n

    # Stay put: a size-0 event, plus (optionally) a request larger than the balance.
    stay = np.full(n, pmf[0])
    if keep_rejected:
        stay = stay + np.maximum(1.0 - cdf[np.minimum(bal, K)], 0.0)
    rows, cols, vals = [np.arange(n)], [np.arange(n)], [stay]

    for k in range(1, K + 1):
        ok = np.nonzero(bal >= k)[0]
        if ok.size == 0:
            continue
        if withdrawal:   # cash down, float up
            tgt = space.index[space.cash[ok] - k, space.float_[ok] + k]
        else:            # cash up, float down
            tgt = space.index[space.cash[ok] + k, space.float_[ok] - k]
        assert (tgt >= 0).all()
        rows.append(ok)
        cols.append(tgt)
        vals.append(np.full(ok.size, pmf[k]))

    return coo_matrix((np.concatenate(vals),
                       (np.concatenate(rows), np.concatenate(cols))),
                      shape=(n, n)).tocsr()


def build_event_model(pmf: np.ndarray, space: StateSpace,
                      churn_cost_ksh: float = 0.0) -> EventModel:
    """churn_cost_ksh: extra cost of each turned-away customer (lost future business).
    An ASSUMPTION the agent can edit. 0 means only the lost commission counts."""
    K = len(pmf) - 1
    ks = np.arange(K + 1)
    comm_w = np.array([commission_ksh(int(k * UNIT_KSH), True) for k in ks], dtype=float)
    comm_d = np.array([commission_ksh(int(k * UNIT_KSH), False) for k in ks], dtype=float)
    return EventModel(
        space=space, pmf=pmf, comm_w=comm_w, comm_d=comm_d,
        Mw=_move_matrix(space, pmf, True),
        Md=_move_matrix(space, pmf, False),
        rej_cost_w=_tail_sums(pmf * (comm_w + churn_cost_ksh), space.cap)[space.cash],
        rej_cost_d=_tail_sums(pmf * (comm_d + churn_cost_ksh), space.cap)[space.float_],
        Mw_ok=_move_matrix(space, pmf, True, keep_rejected=False),
        Md_ok=_move_matrix(space, pmf, False, keep_rejected=False),
    )


def event_count_pmf(mean: float, tail: float = 1e-10) -> np.ndarray:
    """P(N = n) for n = 0..n_max, N ~ Poisson(mean), truncated at tiny tail mass."""
    if mean <= 0:
        return np.array([1.0])
    n_max = int(poisson.ppf(1 - tail, mean)) + 1
    pi = poisson.pmf(np.arange(n_max + 1), mean)
    return pi / pi.sum()


def _day_pieces(model: EventModel, day: DayParams):
    p = day.p_withdrawal
    M = (p * model.Mw + (1 - p) * model.Md).tocsr()
    r = p * model.rej_cost_w + (1 - p) * model.rej_cost_d
    return M, r


def day_value(model: EventModel, day: DayParams, V: np.ndarray) -> np.ndarray:
    """Exact expected (rejection cost over one day + V of the end-of-day state),
    for every starting state.

    With V = 0 this is the expected lost commission over the day.
    Recursion: J_0 = V, J_n = r + M J_{n-1}, answer = sum_n P(N=n) J_n.
    """
    M, r = _day_pieces(model, day)
    pi = event_count_pmf(day.events_mean)
    J = np.asarray(V, dtype=float).copy()
    out = pi[0] * J
    for n in range(1, len(pi)):
        J = r + M @ J
        out += pi[n] * J
    return out


def end_of_day_distribution(model: EventModel, day: DayParams, mu: np.ndarray) -> np.ndarray:
    """Exact distribution of the state at the end of the day, given start distribution mu."""
    M, _ = _day_pieces(model, day)
    MT = M.T.tocsr()
    pi = event_count_pmf(day.events_mean)
    v = np.asarray(mu, dtype=float).copy()
    out = pi[0] * v
    for n in range(1, len(pi)):
        v = MT @ v
        out += pi[n] * v
    return out
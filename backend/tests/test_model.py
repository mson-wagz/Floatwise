from datetime import date

import numpy as np
import pytest

from floatwise.model.demand import DAY_NAMES, ShopDemand, size_pmf
from floatwise.model.grid import apply_restock, build_state_space
from floatwise.model.kernel import build_event_model, day_value, end_of_day_distribution
from floatwise.model.simulate import never_restock, simulate, threshold_policy

D = date(2026, 10, 14)  # a plain Wednesday, no payday or market effect


@pytest.fixture(scope="module")
def setup():
    space = build_state_space(cap=80)
    demand = ShopDemand(base_events_per_day=30,
                        dow_mult={d: 1.0 for d in DAY_NAMES},
                        market_days=(), payday_dates=())
    model = build_event_model(demand.size_pmf(), space)
    return space, demand, model


def test_size_pmf_sums_to_one_and_keeps_the_mean():
    pmf = size_pmf(3000, 1.0)
    assert abs(pmf.sum() - 1) < 1e-9
    mean_ksh = (np.arange(len(pmf)) * pmf).sum() * 1000
    assert abs(mean_ksh - 3000) / 3000 < 0.01


def test_every_kernel_row_sums_to_one(setup):
    _, _, model = setup
    for M in (model.Mw, model.Md):
        assert np.allclose(np.asarray(M.sum(axis=1)).ravel(), 1.0)


def test_transactions_conserve_cash_plus_float(setup):
    space, _, model = setup
    total = space.cash + space.float_
    for M in (model.Mw, model.Md):
        coo = M.tocoo()
        assert (total[coo.row] == total[coo.col]).all()


def test_restock_never_exceeds_capacity():
    rng = np.random.default_rng(0)
    cash = rng.integers(0, 40, 1000)
    flt = rng.integers(0, 40, 1000)
    nc, nf = apply_restock(cash, flt, rng.integers(0, 100, 1000), rng.integers(0, 100, 1000), cap=80)
    assert (nc >= cash).all() and (nf >= flt).all()
    assert (nc + nf).max() <= 80


def test_market_day_and_payday_raise_demand():
    demand = ShopDemand()
    plain = demand.day_params(date(2026, 10, 14)).events_mean   # Wednesday
    market = demand.day_params(date(2026, 10, 17)).events_mean  # Saturday
    payday = demand.day_params(date(2026, 10, 25)).events_mean  # 25th
    assert market > plain and payday > plain


def test_balances_never_negative_and_never_exceed_capacity(setup):
    space, demand, model = setup
    res = simulate(model, demand, D, 14, 40, 40, n_paths=2000,
                   policy=threshold_policy(10, 40, 10, 40), seed=3)
    assert res.cash_end.min() >= 0 and res.float_end.min() >= 0
    assert (res.cash_end + res.float_end).max() <= space.cap


def test_without_restocking_total_is_conserved(setup):
    _, demand, model = setup
    res = simulate(model, demand, D, 7, 30, 45, n_paths=2000, policy=never_restock, seed=4)
    assert ((res.cash_end + res.float_end) == 75).all()


def test_simulator_matches_exact_expected_loss(setup):
    space, demand, model = setup
    c0, f0 = 25, 50
    exact = day_value(model, demand.day_params(D), np.zeros(space.n))[space.index[c0, f0]]
    res = simulate(model, demand, D, 1, c0, f0, n_paths=40_000, policy=never_restock, seed=1)
    x = res.lost_commission_ksh[0]
    se = x.std(ddof=1) / np.sqrt(x.size)
    assert exact > 0
    assert abs(x.mean() - exact) < 4 * se


def test_simulator_matches_exact_end_of_day_cash(setup):
    space, demand, model = setup
    c0, f0 = 25, 50
    mu = np.zeros(space.n)
    mu[space.index[c0, f0]] = 1.0
    dist = end_of_day_distribution(model, demand.day_params(D), mu)
    assert abs(dist.sum() - 1) < 1e-9
    exact_mean = (dist * space.cash).sum()
    res = simulate(model, demand, D, 1, c0, f0, n_paths=40_000, policy=never_restock, seed=2)
    x = res.cash_end[0].astype(float)
    se = x.std(ddof=1) / np.sqrt(x.size)
    assert abs(x.mean() - exact_mean) < 4 * se
from datetime import date, timedelta

import numpy as np
import pytest

from floatwise.model.costs import RestockCosts
from floatwise.model.demand import DAY_NAMES, ShopDemand
from floatwise.model.grid import build_state_space
from floatwise.model.kernel import build_event_model, day_value
from floatwise.model.risk import p_stockout_no_restock
from floatwise.model.simulate import never_restock, simulate
from floatwise.model.solver import (RestockOption, as_simulation_policy,
                                    evaluate_policy, recommend, solve, trace)

D = date(2026, 10, 14)
CHURN = 150.0
H = 4


@pytest.fixture(scope="module")
def setup():
    space = build_state_space(cap=80)
    demand = ShopDemand(base_events_per_day=30,
                        dow_mult={d: 1.0 for d in DAY_NAMES},
                        market_days=(), payday_dates=())
    model = build_event_model(demand.size_pmf(), space, churn_cost_ksh=CHURN)
    plan = solve(model, demand, D, H, RestockCosts())
    return space, demand, model, plan


def test_exact_stockout_probability_matches_simulation(setup):
    _, demand, model, _ = setup
    exact = p_stockout_no_restock(model, demand, D, 3, 25, 50)
    res = simulate(model, demand, D, 3, 25, 50, n_paths=40_000,
                   policy=never_restock, seed=5)
    sim = res.p_stockout_by_day()
    se = np.sqrt(np.maximum(exact * (1 - exact), 1e-4) / 40_000)
    assert (np.abs(sim - exact) < 4 * se + 1e-3).all()


def test_optimal_plan_is_never_worse_than_waiting(setup):
    space, demand, model, plan = setup
    V = np.zeros(space.n)
    for t in range(H - 1, -1, -1):
        V = day_value(model, demand.day_params(D + timedelta(days=t)), V)
    assert (plan.V[0] <= V + 1e-6).all()


def test_backward_induction_is_consistent_and_beats_a_threshold_rule(setup):
    space, _, _, plan = setup
    assert np.allclose(evaluate_policy(plan, plan.policy), plan.V[0])
    m = plan.menu
    ic, iff, ib = (m.index(RestockOption(50, 0)), m.index(RestockOption(0, 50)),
                   m.index(RestockOption(50, 50)))
    low_c, low_f = space.cash < 15, space.float_ < 15
    a = np.where(low_c & low_f, ib, np.where(low_c, ic, np.where(low_f, iff, 0)))
    assert (plan.V[0] <= evaluate_policy(plan, [a] * H) + 1e-6).all()


def test_plan_value_matches_simulation_of_its_own_policy(setup):
    _, demand, model, plan = setup
    c0, f0 = 5, 40
    res = simulate(model, demand, D, H, c0, f0, n_paths=20_000,
                   policy=as_simulation_policy(plan), costs=plan.costs, seed=9)
    total = (res.lost_commission_ksh.sum(axis=0)
             + CHURN * (res.rejected_withdrawals + res.rejected_deposits).sum(axis=0)
             + res.restock_cost_ksh.sum(axis=0))
    se = total.std(ddof=1) / np.sqrt(total.size)
    assert abs(total.mean() - plan.value(c0, f0)) < 4 * se


def test_trace_and_recommendation_are_well_formed(setup):
    space, _, _, plan = setup
    rows = trace(plan, 5, 40)
    assert len(rows) == H
    for r in rows:
        assert -1e-9 <= r["p_restock"] <= 1 + 1e-9
        assert 0 <= r["mean_cash_ksh"] <= space.cap * 1000
    risk = recommend(plan, 5, 40)["p_stockout_by_day_no_restock"]
    assert all(b >= a - 1e-12 for a, b in zip(risk, risk[1:]))
import json
from datetime import date

import pytest

from floatwise.model.demand import ShopDemand
from floatwise.model.fit import fit_demand
from floatwise.model.solver import RestockOption
from floatwise.model.tools import (ShopContext, _clamp_add, get_forecast,
                                   get_recommendation, run_whatif)
from floatwise.synthetic import SynthProfile, generate

TODAY = date(2026, 10, 27)


def _ctx(cash, flt):
    return ShopContext(demand=ShopDemand(), cash_ksh=cash, float_ksh=flt, today=TODAY)


def test_fit_recovers_the_main_patterns():
    res = generate(SynthProfile(), date(2026, 6, 1), 180, seed=3)
    demand, info = fit_demand(res.transactions)
    assert 0.5 * 49 < demand.base_events_per_day < 1.3 * 49
    assert 0.6 < demand.p_withdrawal < 0.8
    assert demand.market_mult > 1.2
    assert demand.payday_mult > 1.2
    assert 178 <= info["n_days"] <= 180


def test_fit_needs_enough_data():
    with pytest.raises(ValueError):
        fit_demand([])


def test_restock_amount_is_clamped_to_room():
    assert _clamp_add(RestockOption(100, 0), 40_000, 40_000) == (70_000, 0)
    assert _clamp_add(RestockOption(50, 50), 40_000, 40_000) == (50_000, 20_000)
    assert _clamp_add(RestockOption(20, 20), 75_000, 75_000) == (0, 0)


def test_recommendation_when_cash_is_nearly_out():
    out = get_recommendation(_ctx(3_000, 40_000), horizon_days=5)
    json.dumps(out)   # must be JSON-friendly
    r = out["restock"]
    assert r is not None and r["day_index"] == 0 and r["add_cash_ksh"] > 0
    assert 3_000 + 40_000 + r["add_cash_ksh"] + r["add_float_ksh"] <= 150_000
    risk = out["p_stockout_by_day_no_restock"]
    assert all(b >= a - 1e-9 for a, b in zip(risk, risk[1:]))


def test_forecast_ranges_are_ordered():
    out = get_forecast(_ctx(40_000, 40_000), horizon_days=4)
    json.dumps(out)
    assert len(out["days"]) == 4
    for d in out["days"]:
        assert d["cash_p10_ksh"] <= d["cash_p50_ksh"] <= d["cash_p90_ksh"]
        assert d["float_p10_ksh"] <= d["float_p50_ksh"] <= d["float_p90_ksh"]


def test_whatif_higher_demand_raises_risk():
    out = run_whatif(_ctx(40_000, 40_000), demand_multiplier=1.5, horizon_days=4)
    json.dumps(out)
    b = out["baseline"]["p_stockout_by_day_no_restock"]
    s = out["scenario"]["p_stockout_by_day_no_restock"]
    assert s[-1] > b[-1]
    assert out["assumptions_changed"]


def test_whatif_rejects_a_bad_day_name():
    with pytest.raises(ValueError):
        run_whatif(_ctx(40_000, 40_000), market_day="funday", horizon_days=3)
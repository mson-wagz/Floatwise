from datetime import date

from floatwise.synthetic import SynthProfile, generate


def _run(seed=1, days=120):
    return generate(SynthProfile(), date(2026, 6, 1), days, seed)


def test_same_seed_gives_same_data():
    a, b = _run(seed=7), _run(seed=7)
    assert [t.amount_ksh for t in a.transactions] == [t.amount_ksh for t in b.transactions]


def test_balances_never_go_negative():
    res = _run()
    cash, flt = res.opening_cash, res.opening_float
    for t in res.transactions:
        cash += t.cash_delta_ksh
        flt += t.float_delta_ksh
        assert cash >= 0 and flt >= 0


def test_market_day_has_more_withdrawals():
    res = _run(days=180)
    by_day: dict = {}
    for t in res.transactions:
        if t.type.value == "withdrawal":
            by_day[t.timestamp.date()] = by_day.get(t.timestamp.date(), 0) + 1
    sat = [n for d, n in by_day.items() if d.strftime("%A") == "Saturday"]
    other = [n for d, n in by_day.items() if d.strftime("%A") != "Saturday"]
    assert sum(sat) / len(sat) > sum(other) / len(other)


def test_feel_based_restocking_causes_some_stockouts():
    assert len(_run().missed) > 0
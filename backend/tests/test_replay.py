import json
from datetime import date, datetime, timedelta

import pytest

from floatwise.ingest.sms_parser import TZ
from floatwise.model.demand import ShopDemand
from floatwise.model.replay import replay_month
from floatwise.model.tools import ShopContext
from floatwise.schema import Source, Transaction, TxnType, apply_deltas

TODAY = date(2026, 10, 28)


def _txn(i, days_ago, kind, amount):
    d = TODAY - timedelta(days=days_ago)
    dc, df = apply_deltas(kind, amount)
    return Transaction(id=f"t{i}", timestamp=datetime(d.year, d.month, d.day, 10, 0, tzinfo=TZ),
                       type=kind, amount_ksh=amount, cash_delta_ksh=dc, float_delta_ksh=df,
                       source=Source.manual)


def _ctx(cash, flt, txns):
    return ShopContext(demand=ShopDemand(), cash_ksh=cash, float_ksh=flt, today=TODAY,
                       transactions=txns)


def _history(extra=()):
    # Two transactions that cancel out, so they only set the start of the history.
    return [_txn(1, 14, TxnType.deposit, 1000), _txn(2, 2, TxnType.withdrawal, 1000),
            *extra]


def test_the_plan_beats_never_restocking():
    r = replay_month(_ctx(20_000, 60_000, _history()), days=14, n_paths=1500)
    json.dumps(r)
    assert r["actual"]["restock_cost_ksh"] == 0
    assert r["with_plan"]["total_cost_ksh"] < r["actual"]["total_cost_ksh"]
    low, high = r["saving_range_ksh"]
    assert r["estimated_saving_ksh"] > 0 and low <= r["estimated_saving_ksh"] <= high
    assert len(r["daily"]) == 14 and "Estimated" in r["method_note"]


def test_real_restocks_are_replayed_and_the_start_balance_is_reconstructed():
    extra = [_txn(3, 10, TxnType.cash_banking, 50_000)]
    r = replay_month(_ctx(60_000, 60_000, _history(extra)), days=14, n_paths=1500)
    assert r["starting_balances"] == {"cash_ksh": 10_000, "float_ksh": 60_000}
    assert r["actual"]["restock_cost_ksh"] > 0


def test_too_little_history_is_refused():
    with pytest.raises(ValueError, match="at least"):
        replay_month(_ctx(40_000, 40_000, [_txn(1, 1, TxnType.deposit, 1000)]))
    with pytest.raises(ValueError, match="No transaction history"):
        replay_month(_ctx(40_000, 40_000, []))


def test_balances_that_do_not_reconcile_are_refused():
    extra = [_txn(3, 10, TxnType.cash_banking, 50_000)]
    with pytest.raises(ValueError, match="do not match"):
        replay_month(_ctx(0, 60_000, _history(extra)), days=14)


def test_sales_to_the_bank_are_reconciled_and_replayed():
    sweep = Transaction(id="s1", timestamp=datetime(2026, 10, 18, 7, 0, tzinfo=TZ),
                        type=TxnType.other, amount_ksh=20_000, cash_delta_ksh=0,
                        float_delta_ksh=-20_000, source=Source.manual)
    r = replay_month(_ctx(60_000, 60_000, _history([sweep])), days=14, n_paths=1500)
    print(f"Starting balances: {r['starting_balances']}")
    print(f"Restock cost (actual): {r['actual']['restock_cost_ksh']}")
    print(f"Full replay result: {r}")
    assert r["starting_balances"] == {"cash_ksh": 60_000, "float_ksh": 80_000}
    assert r["actual"]["restock_cost_ksh"] == 299
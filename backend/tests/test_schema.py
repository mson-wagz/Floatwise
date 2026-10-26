from floatwise.schema import TxnType, apply_deltas


def test_withdrawal_moves_cash_down_and_float_up():
    assert apply_deltas(TxnType.withdrawal, 5000) == (-5000, 5000)


def test_deposit_moves_cash_up_and_float_down():
    assert apply_deltas(TxnType.deposit, 5000) == (5000, -5000)


def test_withdrawal_and_deposit_conserve_total():
    for t in (TxnType.withdrawal, TxnType.deposit):
        cash, flt = apply_deltas(t, 1234)
        assert cash + flt == 0
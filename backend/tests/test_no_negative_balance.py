import pytest
from floatwise.model.simulate import simulate_cash_flow

def test_no_negative_balance():
    initial_balance = 1000
    transactions = [
        {"amount": 200, "type": "debit"},
        {"amount": 300, "type": "debit"},
        {"amount": 500, "type": "credit"},
        {"amount": 100, "type": "debit"},
    ]
    
    final_balance = simulate_cash_flow(initial_balance, transactions)
    
    assert final_balance >= 0, "Balance should not be negative after transactions"
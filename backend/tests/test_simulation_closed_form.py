import pytest
from floatwise.model.simulate import simulate_cash_flow

def test_simulate_cash_flow():
    # Test case 1: Basic scenario
    initial_cash = 1000
    inflow = 500
    outflow = 300
    expected_cash_after_simulation = 1200
    result = simulate_cash_flow(initial_cash, inflow, outflow)
    assert result == expected_cash_after_simulation, f"Expected {expected_cash_after_simulation}, but got {result}"

    # Test case 2: No inflow
    initial_cash = 1000
    inflow = 0
    outflow = 300
    expected_cash_after_simulation = 700
    result = simulate_cash_flow(initial_cash, inflow, outflow)
    assert result == expected_cash_after_simulation, f"Expected {expected_cash_after_simulation}, but got {result}"

    # Test case 3: No outflow
    initial_cash = 1000
    inflow = 500
    outflow = 0
    expected_cash_after_simulation = 1500
    result = simulate_cash_flow(initial_cash, inflow, outflow)
    assert result == expected_cash_after_simulation, f"Expected {expected_cash_after_simulation}, but got {result}"

    # Test case 4: Negative cash flow
    initial_cash = 1000
    inflow = 200
    outflow = 1500
    expected_cash_after_simulation = -300
    result = simulate_cash_flow(initial_cash, inflow, outflow)
    assert result == expected_cash_after_simulation, f"Expected {expected_cash_after_simulation}, but got {result}"
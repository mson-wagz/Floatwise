import time
from datetime import date

from floatwise.model.costs import RestockCosts
from floatwise.model.demand import ShopDemand
from floatwise.model.grid import build_state_space
from floatwise.model.kernel import build_event_model
from floatwise.model.solver import recommend, solve

t0 = time.time()
demand = ShopDemand()
model = build_event_model(demand.size_pmf(), build_state_space(), churn_cost_ksh=150.0)
plan = solve(model, demand, date(2026, 10, 27), 14, RestockCosts())
rec = recommend(plan, 40, 40)          # KSh 40,000 cash and KSh 40,000 float
print(f"solved in {time.time() - t0:.1f}s\n")

if rec["restock"]:
    print(f"RESTOCK on {rec['restock_date']}: add KSh {rec['add_cash_ksh']:,} cash, "
          f"KSh {rec['add_float_ksh']:,} float")
    print(f"Chance a customer is turned away before then: {rec['p_stockout_before_restock']:.0%}")
else:
    print("No restock needed in the horizon")
print(f"Expected total cost over 14 days: KSh {rec['expected_cost_ksh']:,.0f}\n")

print("date        P(restock)  usual option (cash/float units)  P(turned away by day, if no restock)")
for r, p in zip(rec["trace"], rec["p_stockout_by_day_no_restock"]):
    o = r["top_option"]
    print(f"{r['date']}   {r['p_restock']:6.0%}      +{o.cash_units:>3}/+{o.float_units:<3}"
          f"                          {p:6.0%}")
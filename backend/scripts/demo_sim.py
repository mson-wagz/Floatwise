from datetime import date

from floatwise.model.costs import RestockCosts
from floatwise.model.demand import ShopDemand
from floatwise.model.grid import build_state_space
from floatwise.model.kernel import build_event_model
from floatwise.model.simulate import never_restock, simulate, threshold_policy

space = build_state_space()
demand = ShopDemand()
model = build_event_model(demand.size_pmf(), space)
start = date(2026, 10, 27)

policies = {
    "never restock": never_restock,
    "restock when below KSh 15k": threshold_policy(15, 60, 15, 60),
}
for name, pol in policies.items():
    s = simulate(model, demand, start, 14, 40, 40, n_paths=5000,
                 policy=pol, costs=RestockCosts(), seed=1).summary()
    p = s["p_stockout_by_day"]
    print(f"{name:28s} lost commission KSh {s['mean_lost_commission_ksh']:8,.0f} | "
          f"restock cost KSh {s['mean_restock_cost_ksh']:7,.0f} | "
          f"P(stockout) by day 3/7/14: {p[2]:.2f}/{p[6]:.2f}/{p[13]:.2f}")
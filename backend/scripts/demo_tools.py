import json
from datetime import date, timedelta

from floatwise.model.fit import fit_demand
from floatwise.model.tools import ShopContext, get_forecast, get_recommendation, run_whatif
from floatwise.synthetic import SynthProfile, generate

# A quieter shop: about 15 customers a day, 60% withdrawals.
profile = SynthProfile(base_withdrawals=9, base_deposits=6,
                       cash_target=60_000, float_target=60_000)
history = generate(profile, date(2026, 6, 1), 120, seed=11)
demand, info = fit_demand(history.transactions)
print("fitted:", {k: round(getattr(demand, k), 2) for k in
                  ("base_events_per_day", "p_withdrawal", "size_mean_ksh",
                   "size_cv", "market_mult", "payday_mult")})
print(info["note"], "\n")

today = date(2026, 10, 27)
ctx = ShopContext(demand=demand, cash_ksh=60_000, float_ksh=60_000, today=today)

rec = get_recommendation(ctx, horizon_days=10)
print("RECOMMENDATION")
print(json.dumps(rec["restock"], indent=2))
print("P(any customer turned away by day, no restock):",
      rec["p_stockout_by_day_no_restock"], "\n")

fc = get_forecast(ctx, horizon_days=5)
print("FORECAST (no restock)")
for d in fc["days"]:
    print(d["date"], d["weekday"][:3],
          f"cash p10/p50/p90 = {d['cash_p10_ksh']:,}/{d['cash_p50_ksh']:,}/{d['cash_p90_ksh']:,}",
          f"| risk {d['p_stockout_by_this_day']:.0%}")

fees = today + timedelta(days=2)
wi = run_whatif(ctx, events=[{"date": fees.isoformat(), "multiplier": 2.0, "label": "school fees"}],
                horizon_days=10)
print("\nWHAT-IF:", wi["assumptions_changed"])
print("baseline restock:", wi["baseline"]["restock"])
print("scenario restock:", wi["scenario"]["restock"])
print("risk baseline:", wi["baseline"]["p_stockout_by_day_no_restock"][:6])
print("risk scenario:", wi["scenario"]["p_stockout_by_day_no_restock"][:6])
print("expected cost change KSh:", wi["delta"]["expected_cost_ksh"])
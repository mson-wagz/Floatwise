import sys
from datetime import date, datetime, timedelta

sys.stdout.reconfigure(encoding="utf-8")

from floatwise.model.fit import fit_demand
from floatwise.model.replay import replay_month
from floatwise.model.tools import ShopContext
from floatwise.synthetic import SynthProfile, generate

profile = SynthProfile(base_withdrawals=9, base_deposits=6,
                       cash_target=60_000, float_target=60_000)
start, n = date(2026, 6, 1), 120
history = generate(profile, start, n, seed=11)
demand, _ = fit_demand(history.transactions)
cash = history.opening_cash + sum(t.cash_delta_ksh for t in history.transactions)
flt = history.opening_float + sum(t.float_delta_ksh for t in history.transactions)
today = start + timedelta(days=n)
ctx = ShopContext(demand=demand, cash_ksh=cash, float_ksh=flt, today=today,
                  transactions=history.transactions)

print("solving and simulating (the first run takes a while)...")
r = replay_month(ctx, days=30)
print(f"period: {r['period']['from']} to {r['period']['to']}")
print("starting balances:", r["starting_balances"])
print("ACTUAL   :", r["actual"])
print("WITH PLAN:", r["with_plan"])
print(f"estimated saving: KSh {r['estimated_saving_ksh']:,}  "
      f"(range {r['saving_range_ksh'][0]:,} to {r['saving_range_ksh'][1]:,})")

w0 = today - timedelta(days=30)
truth = [m for m in history.missed if datetime.fromisoformat(m["timestamp"]).date() >= w0]
print(f"\nGROUND TRUTH in the synthetic data: {len(truth)} customers turned away, "
      f"KSh {sum(m['lost_commission_ksh'] for m in truth):,} commission lost")
print(f"MODEL ESTIMATE for 'actual'        : {r['actual']['expected_turned_away_customers']} "
      f"customers, KSh {r['actual']['expected_lost_commission_ksh']:,} commission")
print("\n", r["method_note"])
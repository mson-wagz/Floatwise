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
rows = []
for seed in range(1, 7):
    h = generate(profile, start, n, seed=seed)
    demand, _ = fit_demand(h.transactions)
    cash = h.opening_cash + sum(t.cash_delta_ksh for t in h.transactions)
    flt = h.opening_float + sum(t.float_delta_ksh for t in h.transactions)
    today = start + timedelta(days=n)
    ctx = ShopContext(demand=demand, cash_ksh=cash, float_ksh=flt, today=today,
                      transactions=h.transactions)
    try:
        r = replay_month(ctx, days=30, n_paths=2000)
    except ValueError as e:
        print(f"seed {seed}: skipped ({e})")
        continue
    w0 = today - timedelta(days=30)
    truth = sum(1 for m in h.missed if datetime.fromisoformat(m["timestamp"]).date() >= w0)
    est = r["actual"]["expected_turned_away_customers"]
    plan_n = r["with_plan"]["expected_turned_away_customers"]
    rows.append((truth, est, plan_n, r["estimated_saving_ksh"]))
    print(f"seed {seed}: truth {truth:3d} | model 'actual' {est:3d} | model plan {plan_n:3d} "
          f"| saving KSh {r['estimated_saving_ksh']:,}")

if rows:
    k = len(rows)
    print(f"\nmean: truth {sum(r[0] for r in rows) / k:.1f} | model actual "
          f"{sum(r[1] for r in rows) / k:.1f} | model plan {sum(r[2] for r in rows) / k:.1f} "
          f"| saving KSh {sum(r[3] for r in rows) / k:,.0f}")
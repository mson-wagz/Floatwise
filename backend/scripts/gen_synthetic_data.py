import argparse
from datetime import date, timedelta

from floatwise.synthetic import SynthProfile, generate, save

ap = argparse.ArgumentParser()
ap.add_argument("--days", type=int, default=60)
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--out", default="data/synthetic/shop_1.json")
args = ap.parse_args()

start = date.today() - timedelta(days=args.days)
res = generate(SynthProfile(), start, args.days, args.seed)
save(res, args.out)

lost = sum(m["lost_commission_ksh"] for m in res.missed)
print(f"{len(res.transactions)} transactions, {len(res.missed)} missed sales, "
      f"~KSh {lost:,} commission lost -> {args.out}")
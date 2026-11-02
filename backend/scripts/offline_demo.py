"""Offline demo: ask three questions with no model and no internet.

    $env:FLOATWISE_OFFLINE="1"; python scripts/offline_demo.py     (PowerShell)

UNTESTED against your real solver (it was written without access to your model code); if
ShopContext or ShopDemand have different arguments in your repo, adjust the two lines marked.
"""
from __future__ import annotations

import os
import sys
import time
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.stdout.reconfigure(encoding="utf-8")

from floatwise.agent import Toolbox
from floatwise.agent.offline import run_offline
from floatwise.model.demand import ShopDemand                       # <- adjust if needed
from floatwise.model.tools import ShopContext                       # <- adjust if needed

ctx = ShopContext(demand=ShopDemand(market_days=("saturday",), payday_dates=(25, 30)),
                  cash_ksh=60_000, float_ksh=45_000, today=date.today())
tb = Toolbox(ctx)

for q in ("When should I restock cash?",
          "What if school fees are on Thursday?",
          "Niongeze pesa lini?",
          "Je kama soko ni Alhamisi?"):
    t0 = time.time()
    r = run_offline(tb, q)
    print(f"\nQ: {q}\nA: {r.text}\n   [{r.source}, {time.time() - t0:.1f}s]")

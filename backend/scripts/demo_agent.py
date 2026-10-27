import sys
from datetime import date

sys.stdout.reconfigure(encoding="utf-8")

from floatwise.config import settings
from floatwise.llm.agent import Agent
from floatwise.model.fit import fit_demand
from floatwise.model.tools import ShopContext
from floatwise.synthetic import SynthProfile, generate

print("provider:", settings.llm_provider, "| model:", settings.llm()[2], "\n")

profile = SynthProfile(base_withdrawals=9, base_deposits=6,
                       cash_target=60_000, float_target=60_000)
history = generate(profile, date(2026, 6, 1), 120, seed=11)
demand, _ = fit_demand(history.transactions)
ctx = ShopContext(demand=demand, cash_ksh=60_000, float_ksh=60_000, today=date(2026, 10, 27))

questions = [
    ("sw", "Nitahitaji kuongeza pesa taslimu lini?"),
    ("en", "What if school fees land on Thursday 29 October and demand doubles that day?"),
    ("sw", "Soko ni Jumamosi. Hali itakuwaje?"),
]
for lang, q in questions:
    r = Agent(ctx, language=lang).run(q)
    print(f"[{lang}] {q}")
    print("  ->", r.text)
    print(f"  verified={r.verified} fallback={r.used_fallback} retries={r.retries}")
    for c in r.tool_calls:
        print(f"  tool: {c['name']} {c['args']} ok={c['ok']} {c['duration_ms']}ms")
    if r.unsupported:
        print("  rejected numbers:", r.unsupported)
    print()
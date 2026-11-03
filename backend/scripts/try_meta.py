"""Smoke test for any provider: does it answer Swahili, and does it call tools?

    python scripts/try_meta.py              # first provider in your chain
    python scripts/try_meta.py meta         # or fireworks / baseten / local

Reads keys from .env (MODEL_API_KEY, FIREWORKS_API_KEY, BASETEN_API_KEY, LOCAL_LLM_MODEL...).
Needs: pip install openai python-dotenv
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from floatwise.agent.providers import build_chain, describe
from floatwise.agent.toolbox import TOOL_SCHEMAS

PROMPTS = [
    "Habari! Nina duka la M-Pesa. Pesa taslimu zangu zinaisha haraka siku za soko. Nifanye nini?",
    "Niongeze pesa taslimu lini? Nina KSh 60,000 cash na KSh 60,000 float.",
    "What if school fees are on Thursday? How does my restock plan change?",
]

chain = build_chain(sys.argv[1] if len(sys.argv) > 1 else None)
if not chain:
    sys.exit("No provider is configured. Check your .env keys (see src/floatwise/agent/providers.py).")
print("providers:", ", ".join(describe(chain)))
p = chain[0]
print("testing:", p.name, p.model)
for q in PROMPTS:
    try:
        r = p.client.chat([{"role": "system", "content": "You are FloatWise. Reply in the user's language. "
                            "Never compute numbers yourself; call a tool."},
                           {"role": "user", "content": q}], TOOL_SCHEMAS)
    except Exception as e:
        print("\nUSER:", q, "\nFAILED:", type(e).__name__, e)
        continue
    print("\nUSER:", q)
    print("TEXT:", r.content)
    print("TOOL CALLS:", json.dumps([(c.name, c.arguments) for c in r.tool_calls]))

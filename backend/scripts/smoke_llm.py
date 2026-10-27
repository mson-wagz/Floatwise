import json
import sys

# Windows consoles can choke on some characters in model output.
sys.stdout.reconfigure(encoding="utf-8")

from floatwise.config import settings
from floatwise.llm.client import chat


def show_error(e: Exception) -> None:
    print(f"  FAILED: {type(e).__name__}: {e}")
    status = getattr(e, "status_code", None)
    if status:
        print(f"  HTTP status: {status}")
    body = getattr(e, "body", None)
    if body:
        print(f"  Server said: {body}")


def show_message(msg) -> None:
    if msg.content:
        print("  answer:", msg.content)
    else:
        print("  answer is EMPTY. The model may have used its whole token budget "
              "on reasoning. Try a larger max_tokens.")
    extra = {k: v for k, v in msg.model_dump().items()
             if v and k not in ("content", "role")}
    print("  other fields present:", list(extra.keys()))
    for name in ("reasoning_content", "reasoning"):
        if extra.get(name):
            print(f"  ({name} length: {len(str(extra[name]))} chars)")


base_url, api_key, model = settings.llm()
print("provider :", settings.llm_provider)
print("base url :", base_url)
print("model    :", model)
print("key set  :", bool(api_key), f"(length {len(api_key)})\n")

print("TEST 0: plain call")
try:
    r = chat([{"role": "user", "content": "Reply with the single word: ready"}])
    show_message(r.choices[0].message)
    print("  usage:", r.usage)
except Exception as e:
    show_error(e)
    sys.exit("\nStopped: fix this first. Nothing below can work until it does.")

print("\nTEST 1: Swahili")
try:
    r = chat([{"role": "user", "content":
               "Wakala wa M-Pesa ana pesa taslimu KSh 20,000 na float KSh 60,000. "
               "Wateja wengi wanatoa pesa leo. Mweleze kwa Kiswahili rahisi, sentensi mbili, "
               "kwa nini anapaswa kuangalia pesa taslimu yake."}])
    show_message(r.choices[0].message)
except Exception as e:
    show_error(e)

print("\nTEST 2: tool call")
tools = [{"type": "function", "function": {
    "name": "get_recommendation",
    "description": "Get the exact restocking recommendation for the shop.",
    "parameters": {"type": "object",
                   "properties": {"horizon_days": {"type": "integer"}},
                   "required": []}}}]
try:
    r = chat([{"role": "user", "content": "Should I restock cash this week? Use the tool."}],
             tools=tools)
    msg = r.choices[0].message
    if msg.tool_calls:
        tc = msg.tool_calls[0]
        print("  tool requested:", tc.function.name,
              json.loads(tc.function.arguments or "{}"))
    else:
        print("  no tool call.")
        show_message(msg)
except Exception as e:
    show_error(e)
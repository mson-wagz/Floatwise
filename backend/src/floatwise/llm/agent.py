from __future__ import annotations

import json
import time
from dataclasses import dataclass, field

from floatwise.llm.client import chat as default_chat
from floatwise.llm.toolkit import TOOL_SPECS, default_tools
from floatwise.llm.verify import collect_allowed, extract_claims, find_unsupported
from floatwise.model.tools import ShopContext

LANG_NAME = {"sw": "Swahili", "en": "English"}
_SW_DAYS = {"Monday": "Jumatatu", "Tuesday": "Jumanne", "Wednesday": "Jumatano",
            "Thursday": "Alhamisi", "Friday": "Ijumaa", "Saturday": "Jumamosi",
            "Sunday": "Jumapili"}
_UNVERIFIED = {"en": "I could not produce a verified answer. Please try again.",
               "sw": "Sikuweza kutoa jibu lililothibitishwa. Tafadhali jaribu tena."}


def system_prompt(ctx: ShopContext, language: str) -> str:
    return (
        "You are FloatWise, an assistant for mobile money agents in Kenya. You help them "
        "decide when to restock cash and e-float.\n"
        "Rules:\n"
        "1. You never calculate. Every amount, percentage, probability and date you state "
        "must come from a tool result. Call a tool whenever you need a number.\n"
        "2. Write numbers as digits (KSh 22,000 and 46%), never as words. Round percentages "
        "to whole numbers. Do not add, subtract or otherwise calculate; quote amounts as "
        "given. Do not restate the shop's balances unless asked.\n"
        f"3. Reply in {LANG_NAME[language]}, in plain everyday words, at most 3 short "
        "sentences, no lists, no markdown.\n"
        "4. When you quote a risk, make clear it is the chance that at least one customer "
        "is turned away.\n"
        "5. If the recommendation has no restock, say none is needed within the horizon.\n"
        "6. For what-if questions use run_whatif and compare scenario with baseline.\n"
        f"Today is {ctx.today.strftime('%A %Y-%m-%d')}. The shop holds KSh "
        f"{ctx.cash_ksh:,} cash and KSh {ctx.float_ksh:,} e-float.")


@dataclass
class AgentReply:
    text: str
    verified: bool
    used_fallback: bool
    retries: int
    language: str
    tool_calls: list = field(default_factory=list)   # name, args, ok, duration_ms
    results: list = field(default_factory=list)      # name, args, result
    unsupported: list = field(default_factory=list)  # numbers from the last rejected draft


def _assistant_tool_message(msg) -> dict:
    return {"role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": tc.id, "type": "function",
                            "function": {"name": tc.function.name,
                                         "arguments": tc.function.arguments or "{}"}}
                           for tc in msg.tool_calls]}


def _pick_recommendation(results: list):
    for r in reversed(results):
        res = r["result"]
        if not isinstance(res, dict) or "error" in res:
            continue
        if "restock" in res:
            return res
        scen = res.get("scenario")
        if isinstance(scen, dict) and "restock" in scen:
            return scen
    return None


def fallback_text(results: list, language: str) -> str | None:
    """Advice built straight from tool output, with no model involved.
    The Swahili wording should be reviewed by a Swahili speaker."""
    rec = _pick_recommendation(results)
    if rec is None:
        return None
    r = rec["restock"]
    if r is None:
        h = rec.get("evidence", {}).get("horizon_days")
        if h is None:
            return None
        return (f"No restock is needed in the next {h} days." if language == "en"
                else f"Hakuna haja ya kuongeza pesa katika siku {h} zijazo.")
    parts_en, parts_sw = [], []
    if r["add_cash_ksh"]:
        parts_en.append(f"KSh {r['add_cash_ksh']:,} cash")
        parts_sw.append(f"pesa taslimu KSh {r['add_cash_ksh']:,}")
    if r["add_float_ksh"]:
        parts_en.append(f"KSh {r['add_float_ksh']:,} float")
        parts_sw.append(f"float KSh {r['add_float_ksh']:,}")
    amount_en, amount_sw = " and ".join(parts_en), " na ".join(parts_sw)
    pct = round(r["p_stockout_before"] * 100)
    if r["day_index"] == 0:
        return (f"Restock {amount_en} today." if language == "en"
                else f"Ongeza {amount_sw} leo.")
    if language == "en":
        return (f"Restock {amount_en} by {r['weekday']} ({r['date']}). Until then there is "
                f"about a {pct}% chance that at least one customer is turned away.")
    return (f"Ongeza {amount_sw} kufikia {_SW_DAYS.get(r['weekday'], r['weekday'])} "
            f"({r['date']}). Hadi wakati huo kuna uwezekano wa takriban {pct}% kwamba "
            f"angalau mteja mmoja atakosa huduma.")


class Agent:
    def __init__(self, ctx: ShopContext, language: str = "sw", chat_fn=None, tools=None,
                 max_iters: int = 6, max_retries: int = 2, max_tokens: int = 4000):
        if language not in LANG_NAME:
            raise ValueError("language must be 'sw' or 'en'")
        self.ctx, self.language = ctx, language
        self.chat_fn = chat_fn or default_chat
        self.tools = tools if tools is not None else default_tools()
        self.max_iters, self.max_retries, self.max_tokens = max_iters, max_retries, max_tokens

    def _run_tool(self, tc):
        t0, name, args = time.time(), tc.function.name, {}
        try:
            args = json.loads(tc.function.arguments or "{}")
            fn = self.tools.get(name)
            if fn is None:
                raise KeyError(f"unknown tool: {name}")
            out, ok = fn(self.ctx, **args), True
        except Exception as e:  # report the failure to the model instead of crashing
            out, ok = {"error": f"{type(e).__name__}: {e}"}, False
        log = {"name": name, "args": args, "ok": ok,
               "duration_ms": int((time.time() - t0) * 1000)}
        return out, log

    def run(self, question: str, history: list | None = None) -> AgentReply:
        messages = ([{"role": "system", "content": system_prompt(self.ctx, self.language)}]
                    + list(history or []) + [{"role": "user", "content": question}])
        results, calls, retries, bad = [], [], 0, []
        asked = [v for _, v, _ in extract_claims(question)]

        for _ in range(self.max_iters):
            resp = self.chat_fn(messages, tools=TOOL_SPECS, max_tokens=self.max_tokens)
            msg = resp.choices[0].message

            if msg.tool_calls:
                messages.append(_assistant_tool_message(msg))
                for tc in msg.tool_calls:
                    out, log = self._run_tool(tc)
                    calls.append(log)
                    results.append({"name": log["name"], "args": log["args"], "result": out})
                    messages.append({"role": "tool", "tool_call_id": tc.id,
                                     "content": json.dumps(out, default=str)})
                continue

            draft = (msg.content or "").strip()
            nums, dates = collect_allowed([r["result"] for r in results],
                                          [self.ctx.cash_ksh, self.ctx.float_ksh,
                                           self.ctx.today.isoformat()], asked)
            bad = find_unsupported(draft, nums, dates) if draft else ["(empty answer)"]
            if draft and not bad:
                return AgentReply(draft, True, False, retries, self.language, calls, results)

            if retries < self.max_retries:
                retries += 1
                messages.append({"role": "assistant", "content": draft})
                feedback = ("Your answer was empty. Give the final answer now."
                            if not draft else
                            f"These numbers are not supported by the tool results or the "
                            f"user's message: {', '.join(bad)}. Rewrite the answer using only "
                            f"numbers from tool results; call a tool if you need a number you "
                            f"do not have. Keep it in {LANG_NAME[self.language]}.")
                messages.append({"role": "user", "content": feedback})
                continue
            break

        text = fallback_text(results, self.language)
        if text:
            return AgentReply(text, True, True, retries, self.language, calls, results, bad)
        return AgentReply(_UNVERIFIED[self.language], False, True, retries, self.language,
                          calls, results, bad)
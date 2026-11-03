"""The agent loop: the model calls our tools, then we verify its wording against the results."""
from __future__ import annotations

import json
from dataclasses import dataclass, field

from floatwise.agent.advice import detect_language, fallback_advice
from floatwise.agent.client import ChatClient, ChatResponse
from floatwise.agent.toolbox import Toolbox
from floatwise.agent.verifier import verify_advice

SYSTEM_PROMPT = """You are FloatWise, an assistant for mobile money agents in Kenya.
Reply in the language the agent writes in (Swahili or English), in short plain sentences.

Hard rules:
- You never calculate, estimate or guess numbers yourself. For anything about when or how
  much to restock, stockout risk, balances or what-if scenarios, call a tool first.
- Only quote percentages, KSh amounts and weekdays that appear in tool results.
- The restock day is a "likely by" day, not a certainty. Say so.
- A stockout means at least one customer was turned away. Say that when you give a risk.
- If a tool returns an error or you lack the shop's balances, ask the agent for what is missing.
"""

REWRITE_PROMPT = ("Your reply contained numbers that the tools did not return: {problems}. "
                  "Rewrite it using only values from the tool results. Call a tool again if "
                  "you need one.")


@dataclass
class AgentResult:
    text: str
    verified: bool
    source: str                      # "model" or "fallback"
    problems: list[str] = field(default_factory=list)
    tool_results: list[dict] = field(default_factory=list)
    messages: list[dict] = field(default_factory=list)
    provider: str = ""               # which model answered (set by run_chat; empty offline)


def _assistant_message(resp: ChatResponse) -> dict:
    return {"role": "assistant", "content": resp.content,
            "tool_calls": [{"id": c.id, "type": "function",
                            "function": {"name": c.name, "arguments": json.dumps(c.arguments)}}
                           for c in resp.tool_calls]}


def run_agent(client: ChatClient, toolbox: Toolbox, user_message: str, *,
              history: list[dict] | None = None, max_steps: int = 6,
              max_rewrites: int = 1, lang: str | None = None) -> AgentResult:
    lang = lang or detect_language(user_message)
    messages: list[dict] = ([{"role": "system", "content": SYSTEM_PROMPT}]
                            + list(history or [])
                            + [{"role": "user", "content": user_message}])
    results: list[dict] = []
    rewrites = 0
    problems: list[str] = []

    for _ in range(max_steps):
        resp = client.chat(messages, toolbox.schemas)

        if resp.tool_calls:
            messages.append(_assistant_message(resp))
            for call in resp.tool_calls:
                out = toolbox.call(call.name, call.arguments)
                if "error" not in out:
                    results.append(out)
                messages.append({"role": "tool", "tool_call_id": call.id,
                                 "content": json.dumps(out)})
            continue

        reply = (resp.content or "").strip()
        report = verify_advice(reply, results, extra_text=user_message)
        if reply and report.ok:
            messages.append({"role": "assistant", "content": reply})
            return AgentResult(reply, True, "model", [], results, messages)

        problems = report.problems or ["the reply was empty"]
        if rewrites < max_rewrites:
            rewrites += 1
            messages.append({"role": "assistant", "content": reply})
            messages.append({"role": "user",
                             "content": REWRITE_PROMPT.format(problems="; ".join(problems))})
            continue
        break

    text = fallback_advice(results, lang)
    return AgentResult(text, bool(results), "fallback",
                       problems or ["the model did not finish within the step limit"],
                       results, messages)

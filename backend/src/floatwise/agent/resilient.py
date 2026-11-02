"""Failover across model providers, ending in the no-model offline path."""
from __future__ import annotations

import time

from floatwise.agent.advice import detect_language
from floatwise.agent.client import ChatResponse
from floatwise.agent.loop import AgentResult, run_agent
from floatwise.agent.offline import run_offline
from floatwise.connectivity import is_online


class AllModelsFailed(Exception):
    def __init__(self, errors: list[tuple[str, str]]):
        self.errors = errors
        super().__init__("; ".join(f"{n}: {e}" for n, e in errors) or "no model available")


class ResilientClient:
    """A ChatClient that tries each provider in order. A provider that just failed is
    skipped for `cooldown` seconds so one dead connection does not slow every turn.
    Remote providers are skipped entirely while the machine is offline."""

    def __init__(self, chain, cooldown: float = 60.0):
        self.chain = list(chain)
        self.cooldown = cooldown
        self.last_used = ""
        self._down: dict[str, float] = {}

    def chat(self, messages: list[dict], tools: list[dict]) -> ChatResponse:
        errors: list[tuple[str, str]] = []
        online = is_online()
        now = time.monotonic()
        for p in self.chain:
            if p.remote and not online:
                errors.append((p.name, "offline"))
                continue
            if self._down.get(p.name, 0) > now:
                errors.append((p.name, "cooling down after a failure"))
                continue
            try:
                resp = p.client.chat(messages, tools)
                self.last_used = p.name
                return resp
            except Exception as e:   # any provider problem should move us to the next one
                self._down[p.name] = time.monotonic() + self.cooldown
                errors.append((p.name, f"{type(e).__name__}: {e}"))
        raise AllModelsFailed(errors)


def run_chat(toolbox, message: str, chain, *, history: list[dict] | None = None,
             lang: str | None = None, client: ResilientClient | None = None, **kw) -> AgentResult:
    """Answer a question: through a model if one is reachable, otherwise from the solver
    directly with templated advice. result.source is "model", "fallback" or "offline";
    result.provider names the model that answered (empty offline)."""
    lang = lang or detect_language(message)
    rc = client or ResilientClient(chain)
    if chain:
        try:
            res = run_agent(rc, toolbox, message, history=history, lang=lang, **kw)
            res.provider = rc.last_used
            return res
        except AllModelsFailed:
            pass
    return run_offline(toolbox, message, lang)

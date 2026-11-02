"""A scripted stand-in for the model, for tests and offline demos."""
from __future__ import annotations

from floatwise.agent.client import ChatResponse, ToolCall


def tool_call(name: str, arguments: dict | None = None, id: str = "call_1") -> ChatResponse:
    return ChatResponse(tool_calls=[ToolCall(id=id, name=name, arguments=arguments or {})])


def text(content: str) -> ChatResponse:
    return ChatResponse(content=content)


class ScriptedClient:
    """Returns the queued responses in order and records what it was sent."""

    def __init__(self, script: list[ChatResponse]):
        self.script = list(script)
        self.calls: list[list[dict]] = []

    def chat(self, messages: list[dict], tools: list[dict]) -> ChatResponse:
        self.calls.append([dict(m) for m in messages])
        if not self.script:
            raise AssertionError("ScriptedClient ran out of responses")
        return self.script.pop(0)

"""Model client interface plus an OpenAI-compatible implementation for the Meta Model API.

The agent loop only depends on the small `ChatClient` protocol, so tests use a scripted
fake and the real Muse Spark client can be swapped in by setting three env vars.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class ChatResponse:
    content: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)


class ChatClient(Protocol):
    def chat(self, messages: list[dict], tools: list[dict]) -> ChatResponse: ...


def parse_chat_completion(resp: Any) -> ChatResponse:
    """Convert an OpenAI-style chat completion object into a ChatResponse."""
    msg = resp.choices[0].message
    calls: list[ToolCall] = []
    for tc in getattr(msg, "tool_calls", None) or []:
        raw = tc.function.arguments or "{}"
        try:
            args = json.loads(raw)
            if not isinstance(args, dict):
                args = {"_invalid_json": raw}
        except json.JSONDecodeError:
            args = {"_invalid_json": raw}
        calls.append(ToolCall(id=tc.id, name=tc.function.name, arguments=args))
    return ChatResponse(content=getattr(msg, "content", None), tool_calls=calls)


class OpenAICompatClient:
    """Chat-completions client for any OpenAI-compatible endpoint (e.g. Meta Model API).

    Per Meta's docs the key is MODEL_API_KEY (META_API_KEY also accepted), the base URL
    defaults to https://api.meta.ai/v1 (override with META_API_BASE_URL), and the model
    defaults to muse-spark-1.3 (override with META_MODEL_TEXT).
    """

    DEFAULT_BASE_URL = "https://api.meta.ai/v1"
    DEFAULT_MODEL = "muse-spark-1.3"

    def __init__(self, api_key: str | None = None, base_url: str | None = None,
                 model: str | None = None, timeout: float = 60.0, max_retries: int = 2):
        from openai import OpenAI  # imported lazily so tests do not need the package

        key = api_key or os.environ.get("MODEL_API_KEY") or os.environ.get("META_API_KEY")
        if not key:
            raise RuntimeError("Set MODEL_API_KEY (your key from dev.meta.ai).")
        self.model = model or os.environ.get("META_MODEL_TEXT") or self.DEFAULT_MODEL
        self._client = OpenAI(
            api_key=key,
            base_url=base_url or os.environ.get("META_API_BASE_URL") or self.DEFAULT_BASE_URL,
            timeout=timeout,
            max_retries=max_retries,   # 0 when used in a failover chain, so failures are quick
        )

    def complete(self, messages: list[dict], **kwargs):
        """Raw OpenAI-style response (resp.choices[0].message.content). Use this for code that
        expects the raw object, such as extract_with_llm's chat_fn."""
        return self._client.chat.completions.create(model=self.model, messages=messages, **kwargs)

    def chat(self, messages: list[dict], tools: list[dict]) -> ChatResponse:
        resp = self._client.chat.completions.create(
            model=self.model, messages=messages, tools=tools, temperature=0)
        return parse_chat_completion(resp)

from __future__ import annotations

import logging

from openai import BadRequestError, OpenAI

from floatwise.config import KNOWN_PROVIDERS, settings

log = logging.getLogger("floatwise")


def _has_key(name: str) -> bool:
    return bool(settings.llm_for(name)[1])


def _client(name: str) -> tuple[OpenAI, str]:
    base_url, api_key, model = settings.llm_for(name)
    if not api_key:
        raise RuntimeError(f"No API key set for provider '{name}'. Check backend/.env")
    return OpenAI(base_url=base_url, api_key=api_key, timeout=45.0, max_retries=1), model


def get_client() -> tuple[OpenAI, str]:
    """Client for the active provider."""
    return _client(settings.llm_provider)


def _call(name: str, messages: list[dict], tools=None, max_tokens: int = 3000, **kwargs):
    """One chat-completions call to one named provider."""
    client, model = _client(name)
    params = dict(model=model, messages=messages, **kwargs)
    if tools:
        params["tools"] = tools
    try:
        return client.chat.completions.create(max_tokens=max_tokens, **params)
    except BadRequestError as e:
        # Some servers want max_completion_tokens instead of max_tokens.
        if "max_completion_tokens" in str(e):
            return client.chat.completions.create(max_completion_tokens=max_tokens, **params)
        raise


def chat(messages: list[dict], tools: list[dict] | None = None,
         max_tokens: int = 3000, **kwargs):
    """Try each provider in LLM_CHAIN (or just LLM_PROVIDER) in order, skipping any
    without a key, and return the first raw response that works.

    max_tokens is generous on purpose: Muse Spark Open always reasons, and the
    reasoning can use up a small budget before any answer text appears.
    """
    names = [n for n in settings.chain() if _has_key(n)]
    if not names:
        raise RuntimeError(f"No API key set for any of: {', '.join(settings.chain())}. "
                           "Check backend/.env")
    last: Exception | None = None
    for name in names:
        try:
            return _call(name, messages, tools, max_tokens, **kwargs)
        except Exception as e:   # any provider problem moves us to the next one
            last = e
            log.warning("provider %s failed (%s: %s)", name, type(e).__name__, e)
    raise last


def chat_fn_for(name: str):
    """A chat function pinned to ONE provider, for code that takes `chat_fn`, for example
    extract_with_llm(chunks, chat_fn=chat_fn_for("fireworks")). Returns None if that
    provider is unknown or has no key, so callers fall back to the default."""
    name = name.strip().lower()
    if name not in KNOWN_PROVIDERS or not _has_key(name):
        return None

    def fn(messages, tools=None, max_tokens: int = 3000, **kwargs):
        return _call(name, messages, tools, max_tokens, **kwargs)
    return fn
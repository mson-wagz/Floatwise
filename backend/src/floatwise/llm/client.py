from __future__ import annotations

from openai import BadRequestError, OpenAI

from floatwise.config import settings


def get_client() -> tuple[OpenAI, str]:
    base_url, api_key, model = settings.llm()
    if not api_key:
        raise RuntimeError(f"No API key set for provider '{settings.llm_provider}'. "
                           "Check backend/.env")
    return OpenAI(base_url=base_url, api_key=api_key), model


def chat(messages: list[dict], tools: list[dict] | None = None,
         max_tokens: int = 3000, **kwargs):
    """One chat-completions call. Returns the raw response object.

    max_tokens is generous on purpose: Muse Spark Open always reasons, and the
    reasoning can use up a small budget before any answer text appears.
    """
    client, model = get_client()
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
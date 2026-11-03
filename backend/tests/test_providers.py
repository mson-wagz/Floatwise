import pytest

import floatwise.llm.client as client_mod
from floatwise.config import settings
from floatwise.llm.client import chat, chat_fn_for


def _set(monkeypatch, **values):
    for k, v in values.items():
        monkeypatch.setattr(settings, k, v)


def test_pinned_function_needs_a_key(monkeypatch):
    _set(monkeypatch, fireworks_api_key="")
    assert chat_fn_for("fireworks") is None
    _set(monkeypatch, fireworks_api_key="x")
    assert callable(chat_fn_for("fireworks"))


def test_unknown_provider_gives_none():
    assert chat_fn_for("nope") is None


def test_chain_falls_over_in_order(monkeypatch):
    _set(monkeypatch, baseten_api_key="a", fireworks_api_key="b",
         llm_provider="baseten", llm_chain="baseten,fireworks")
    calls = []

    def fake(name, messages, tools, max_tokens, **kw):
        calls.append(name)
        if name == "baseten":
            raise RuntimeError("down")
        return "ok"
    monkeypatch.setattr(client_mod, "_call", fake)
    assert chat([{"role": "user", "content": "hi"}]) == "ok"
    assert calls == ["baseten", "fireworks"]


def test_all_providers_failing_raises_the_last_error(monkeypatch):
    _set(monkeypatch, baseten_api_key="a", fireworks_api_key="b",
         llm_provider="baseten", llm_chain="baseten,fireworks")

    def fake(name, messages, tools, max_tokens, **kw):
        raise RuntimeError(f"{name} down")
    monkeypatch.setattr(client_mod, "_call", fake)
    with pytest.raises(RuntimeError, match="fireworks down"):
        chat([{"role": "user", "content": "hi"}])


def test_providers_without_a_key_are_skipped(monkeypatch):
    _set(monkeypatch, baseten_api_key="", fireworks_api_key="b", meta_api_key="",
         llm_provider="baseten", llm_chain="baseten,fireworks,meta")
    calls = []

    def fake(name, messages, tools, max_tokens, **kw):
        calls.append(name)
        return "ok"
    monkeypatch.setattr(client_mod, "_call", fake)
    chat([{"role": "user", "content": "hi"}])
    assert calls == ["fireworks"]


def test_no_keys_at_all_is_a_clear_error(monkeypatch):
    _set(monkeypatch, baseten_api_key="", fireworks_api_key="", meta_api_key="",
         llm_provider="baseten", llm_chain="")
    with pytest.raises(RuntimeError, match="No API key"):
        chat([{"role": "user", "content": "hi"}])
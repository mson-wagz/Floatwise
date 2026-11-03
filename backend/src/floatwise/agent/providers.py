"""Model providers as a chain: try the first, fall back to the next, then to no model at all.

Every provider speaks the OpenAI chat-completions format, so each one is just a base URL,
a key and a model name. Values below are defaults; override any of them in .env.
CONFIRM the Fireworks and Baseten base URLs against your dashboards (copy the ones your
current .env already uses). The local entry points at a model you serve yourself
(vLLM, llama.cpp, Ollama...) and needs LOCAL_LLM_MODEL set.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from floatwise.agent.client import OpenAICompatClient

PRESETS: dict[str, dict] = {
    "meta": {"keys": ("MODEL_API_KEY", "META_API_KEY"), "base_url": "https://api.meta.ai/v1",
             "model": "muse-spark-1.3", "model_env": "META_MODEL_TEXT", "remote": True},
    "fireworks": {"keys": ("FIREWORKS_API_KEY",), "base_url": "https://api.fireworks.ai/inference/v1",
                  "model": "accounts/fireworks/models/muse-spark-open",
                  "model_env": "FIREWORKS_MODEL", "remote": True},
    "baseten": {"keys": ("BASETEN_API_KEY",), "base_url": "https://inference.baseten.co/v1",
                "model": "meta-models/muse-spark-open-1026",
                "model_env": "BASETEN_MODEL", "remote": True},
    "local": {"keys": (), "base_url": "http://localhost:8000/v1", "model": None,
              "model_env": "LOCAL_LLM_MODEL", "remote": False},
    # Muse Spark Open on a Modal endpoint. No default URL: copy the endpoint URL and model name
    # from your Modal dashboard into MODAL_BASE_URL and MODAL_MODEL, and the key into MODAL_API_KEY.
    "modal": {"keys": ("MODAL_API_KEY",), "base_url": None, "model": None,
              "model_env": "MODAL_MODEL", "remote": True},
}
DEFAULT_CHAIN = "meta,fireworks,baseten,local"


@dataclass
class Provider:
    name: str
    client: object
    remote: bool
    model: str = ""


def build_chain(spec: str | None = None, env: dict | None = None) -> list[Provider]:
    """Providers named in `spec` (or LLM_CHAIN), in order. Ones without a key are skipped."""
    env = os.environ if env is None else env
    spec = spec or env.get("LLM_CHAIN") or DEFAULT_CHAIN
    chain: list[Provider] = []
    for raw in spec.split(","):
        name = raw.strip().lower()
        p = PRESETS.get(name)
        if not p:
            raise ValueError(f"unknown provider '{name}'. Known: {', '.join(PRESETS)}")
        key = next((env[k] for k in p["keys"] if env.get(k)), None)
        if p["remote"] and not key:
            continue
        model = env.get(p["model_env"]) or p["model"]
        if not model:
            continue   # e.g. local without LOCAL_LLM_MODEL
        base = env.get(f"{name.upper()}_BASE_URL") or p["base_url"]
        if not base:
            continue   # e.g. modal without MODAL_BASE_URL
        client = OpenAICompatClient(api_key=key or "local", base_url=base, model=model,
                                    timeout=20.0 if p["remote"] else 120.0, max_retries=0)
        chain.append(Provider(name, client, p["remote"], model))
    return chain


def describe(chain: list[Provider]) -> list[str]:
    return [f"{p.name} ({p.model})" + ("" if p.remote else " [local]") for p in chain]


def chat_fn_for(name: str, env: dict | None = None):
    """A raw chat function pinned to ONE provider, for code that takes `chat_fn`, for example
    extract_with_llm(chunks, chat_fn=chat_fn_for("fireworks")). Use it to make a specific
    pipeline stage run on an open-weight model. Returns None if that provider is not set up."""
    chain = build_chain(name, env=env)
    if not chain:
        return None
    client = chain[0].client
    return lambda messages, **kw: client.complete(messages, **kw)

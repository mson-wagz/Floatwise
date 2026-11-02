"""Are we online? One place to ask, and one switch to force offline mode for the demo."""
from __future__ import annotations

import os
import socket
import time

_cache = {"t": -1e9, "v": True}


def offline_forced() -> bool:
    """Set FLOATWISE_OFFLINE=1 to behave as if there is no internet (useful when filming)."""
    return os.getenv("FLOATWISE_OFFLINE", "").strip().lower() in {"1", "true", "yes", "on"}


def is_online(host: str = "1.1.1.1", port: int = 53, timeout: float = 1.5, ttl: float = 10.0) -> bool:
    """Cheap TCP check, cached for `ttl` seconds so it never slows a request down.
    A network that blocks this particular host:port will read as offline, so use
    FLOATWISE_OFFLINE for a guaranteed answer either way."""
    if offline_forced():
        return False
    now = time.monotonic()
    if now - _cache["t"] < ttl:
        return _cache["v"]
    try:
        socket.create_connection((host, port), timeout=timeout).close()
        ok = True
    except OSError:
        ok = False
    _cache.update(t=now, v=ok)
    return ok

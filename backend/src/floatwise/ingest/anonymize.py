from __future__ import annotations

import hashlib
import re

_PHONE = re.compile(r"(?<!\d)(?:\+?254|0)[17]\d{8}(?!\d)")
_NAME = re.compile(r"\b(from|to)\s+[A-Z][A-Za-z .'\-]*?\s+\[PHONE\]")


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    return "254" + digits[1:] if digits.startswith("0") else digits


def hash_phone(raw: str, salt: str = "floatwise-demo") -> str:
    """Stable pseudonym for a customer. The default salt is for the demo only;
    use a secret salt before touching real data."""
    return hashlib.sha256((salt + normalize_phone(raw)).encode()).hexdigest()[:10]


def redact(text: str) -> str:
    """Remove phone numbers and the names next to them (used before any model call)."""
    text = _PHONE.sub("[PHONE]", text)
    return _NAME.sub(lambda m: f"{m.group(1)} [NAME] [PHONE]", text)
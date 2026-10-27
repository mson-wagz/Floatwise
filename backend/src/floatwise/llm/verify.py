from __future__ import annotations

import re

_ISO = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
_NUM = re.compile(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s*(%|[kK]\b)?")


def _walk(obj, nums: set, dates: set) -> None:
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        nums.add(float(obj))
    elif isinstance(obj, str):
        dates.update(_ISO.findall(obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            _walk(v, nums, dates)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _walk(v, nums, dates)


def collect_allowed(*sources) -> tuple[set, set]:
    """Every number and ISO date that appears in the given sources.
    Day, month and year of each date also count as allowed numbers."""
    nums: set = set()
    dates: set = set()
    for s in sources:
        _walk(s, nums, dates)
    for d in dates:
        y, m, dd = (int(x) for x in d.split("-"))
        nums.update({float(y), float(m), float(dd)})
    return nums, dates


def extract_claims(text: str) -> list[tuple[str, float, bool]]:
    """(raw text, value, is_percent) for every number in the text.
    '22k' means 22,000. ISO dates are handled separately."""
    text = _ISO.sub(" ", text)
    out = []
    for m in _NUM.finditer(text):
        value = float(m.group(1).replace(",", ""))
        suffix = m.group(2)
        if suffix and suffix.lower() == "k":
            value *= 1000
        out.append((m.group(0).strip(), value, suffix == "%"))
    return out


def _supported(value: float, is_pct: bool, nums: set) -> bool:
    tol = 0.5 if value >= 1 else 0.01
    for a in nums:
        if abs(a - value) <= tol:
            return True
        if is_pct and 0 <= a <= 1 and abs(a * 100 - value) <= 0.5:
            return True
    return False


def find_unsupported(text: str, nums: set, dates: set) -> list[str]:
    """Numbers and dates in `text` that no tool result (or the user) supports.

    This is a safety net, not a proof: it catches invented and miscalculated figures,
    but a real number used in the wrong place can still slip through.
    """
    bad = [d for d in _ISO.findall(text) if d not in dates]
    for raw, value, is_pct in extract_claims(text):
        if not _supported(value, is_pct, nums):
            bad.append(raw)
    return bad
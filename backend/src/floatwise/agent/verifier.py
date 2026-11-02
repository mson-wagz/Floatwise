"""Checks that the numbers in the model's advice come from the solver's tool results.

Scope: percentages, KSh amounts and weekday names. Anything the model says in those three
forms must match a value the tools returned (or one the user typed). Day counts and other
prose numbers are not checked.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import date, timedelta

WEEKDAYS = {
    "monday": "Monday", "tuesday": "Tuesday", "wednesday": "Wednesday",
    "thursday": "Thursday", "friday": "Friday", "saturday": "Saturday", "sunday": "Sunday",
    "jumatatu": "Monday", "jumanne": "Tuesday", "jumatano": "Wednesday",
    "alhamisi": "Thursday", "ijumaa": "Friday", "jumamosi": "Saturday", "jumapili": "Sunday",
}

_PCT = re.compile(r"(\d+(?:\.\d+)?)\s*(?:%|percent\b)|asilimia\s*(\d+(?:\.\d+)?)", re.I)
_KSH_PRE = re.compile(r"(?<![A-Za-z])(?:KSh|Ksh|KES|Sh)\.?\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?(?![\w])")
_KSH_POST = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*(?:KSh|Ksh|KES|shillings)\b", re.I)
_DAY = re.compile(r"\b(" + "|".join(WEEKDAYS) + r")\b", re.I)


@dataclass
class Claims:
    percents: list[float] = field(default_factory=list)
    ksh: list[float] = field(default_factory=list)
    weekdays: list[str] = field(default_factory=list)


@dataclass
class VerifyReport:
    ok: bool
    problems: list[str]


def _num(text: str, k: str | None) -> float:
    v = float(text.replace(",", ""))
    return v * 1000 if k else v


def extract_claims(text: str) -> Claims:
    c = Claims()
    for m in _PCT.finditer(text):
        c.percents.append(float(m.group(1) or m.group(2)))
    for rx in (_KSH_PRE, _KSH_POST):
        for m in rx.finditer(text):
            c.ksh.append(_num(m.group(1), m.group(2)))
    for m in _DAY.finditer(text):
        c.weekdays.append(WEEKDAYS[m.group(1).lower()])
    return c


@dataclass
class Facts:
    percents: list[float] = field(default_factory=list)   # 0-100 scale
    ksh: set[float] = field(default_factory=set)
    weekdays: set[str] = field(default_factory=set)


def collect_facts(results: list[dict]) -> Facts:
    f = Facts()

    def walk(key: str, v) -> None:
        if isinstance(v, dict):
            if "add_cash_ksh" in v and "add_float_ksh" in v:
                f.ksh.add(float(v["add_cash_ksh"]) + float(v["add_float_ksh"]))
            if isinstance(v.get("weekday"), str):
                f.weekdays.add(v["weekday"])
                try:   # "before then" can legitimately name the previous day
                    d = date.fromisoformat(v["date"]) - timedelta(days=1)
                    f.weekdays.add(d.strftime("%A"))
                except (KeyError, ValueError):
                    pass
            for k, x in v.items():
                walk(k, x)
        elif isinstance(v, (list, tuple)):
            for x in v:
                walk(key, x)
        elif isinstance(v, bool):
            return
        elif isinstance(v, (int, float)):
            if key.startswith("p_"):
                f.percents.append(abs(float(v)) * 100)
            elif key.endswith("_ksh"):
                f.ksh.add(abs(float(v)))

    for r in results:
        walk("", r)
    return f


def _pct_ok(c: float, facts: Facts) -> bool:
    return any(abs(c - p) <= 1.0 for p in facts.percents)


def _ksh_ok(c: float, facts: Facts) -> bool:
    for a in facts.ksh:
        if abs(c - a) <= 1 or c == round(a, -2) or c == round(a, -3):
            return True
    return False


def verify_advice(text: str, results: list[dict], extra_text: str = "") -> VerifyReport:
    """Return which claims in `text` are not backed by `results` (or the user's own message)."""
    claims = extract_claims(text)
    facts = collect_facts(results)
    user = extract_claims(extra_text)
    facts.percents += user.percents
    facts.ksh |= set(user.ksh)
    problems: list[str] = []

    if (claims.percents or claims.ksh or claims.weekdays) and not results:
        problems.append("numbers were stated without calling any tool")

    for p in claims.percents:
        if not _pct_ok(p, facts):
            problems.append(f"{p:g}% is not a probability returned by the tools")
    for k in claims.ksh:
        if not _ksh_ok(k, facts):
            problems.append(f"KSh {k:,.0f} is not an amount returned by the tools")
    for d in claims.weekdays:
        if results and d not in facts.weekdays:
            problems.append(f"{d} is not a day named in the tool results")

    seen: set[str] = set()
    problems = [p for p in problems if not (p in seen or seen.add(p))]
    return VerifyReport(ok=not problems, problems=problems)

"""Answer without any language model: read the question with simple rules, call the same
tools, and write the advice from templates. Works with no internet at all.

The numbers in the advice are always tool output. The one thing the rules decide is which
tool to call and with what inputs (a weekday, a demand multiplier), and when they assume
a value (default multiplier) the answer says so in a separate "Assumption" line.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from floatwise.agent.advice import _SW_DAYS, detect_language, fallback_advice
from floatwise.agent.loop import AgentResult
from floatwise.agent.verifier import WEEKDAYS

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DEFAULT_MULT = 1.8   # ASSUMPTION used when someone says "school fees" without a size

_DAY = re.compile(r"\b(" + "|".join(WEEKDAYS) + r")\b", re.I)
_TODAY = re.compile(r"\b(today|leo)\b", re.I)
_TOMORROW = re.compile(r"\b(tomorrow|kesho)\b", re.I)
_MARKET = re.compile(r"market day|siku ya soko|\bsoko\b", re.I)
_FEES = re.compile(r"school fee|\bfees\b|ada ya shule|ada za shule|\bshule\b", re.I)
_WHATIF = re.compile(r"what if|suppose|\bif\b.*\b(fees|market)|je kama|vipi kama|\bkama\b|"
                     r"double|twice|triple|mara mbili|mara tatu", re.I)
_FORECAST = re.compile(r"forecast|next few days|how will|cash look|utabiri|siku zijazo|wiki ijayo", re.I)
_MULT_NUM = re.compile(r"x\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:x|times)\b", re.I)


def _next_date(today: date, day_name: str) -> date:
    delta = (DAYS.index(day_name) - today.weekday()) % 7 or 7
    return today + timedelta(days=delta)


def _multiplier(text: str) -> tuple[float, bool]:
    """(value, was_assumed)"""
    m = _MULT_NUM.search(text)
    if m:
        v = float(m.group(1) or m.group(2))
        if 0 < v <= 10:
            return v, False
    if re.search(r"double|twice|mara mbili", text, re.I):
        return 2.0, False
    if re.search(r"triple|mara tatu", text, re.I):
        return 3.0, False
    return DEFAULT_MULT, True


def _say(lang: str, en: str, sw: str) -> str:
    return sw if lang == "sw" else en


def _result(text: str, results: list[dict], verified: bool, problems: list[str] | None = None):
    return AgentResult(text=text, verified=verified, source="offline",
                       problems=problems or [], tool_results=results, messages=[])


def run_offline(toolbox, message: str, lang: str | None = None) -> AgentResult:
    lang = lang or detect_language(message)
    today = getattr(getattr(toolbox, "ctx", None), "today", None) or date.today()
    day = WEEKDAYS[_DAY.search(message).group(1).lower()].lower() if _DAY.search(message) else None
    if not day and _TODAY.search(message):
        day = DAYS[today.weekday()]
    if not day and _TOMORROW.search(message):
        day = DAYS[(today + timedelta(days=1)).weekday()]

    if _WHATIF.search(message) or _MARKET.search(message):
        if _MARKET.search(message) and day:
            tool, args, note = "run_whatif", {"market_day": day, "horizon_days": 14}, ""
        elif (_FEES.search(message) or _MULT_NUM.search(message)
              or re.search(r"double|twice|triple|mara mbili|mara tatu", message, re.I)) and day:
            mult, assumed = _multiplier(message)
            if _TODAY.search(message) or _TOMORROW.search(message):
                when = today if _TODAY.search(message) else today + timedelta(days=1)
            else:
                when = _next_date(today, day)
            label = "school fees" if _FEES.search(message) else "high demand"
            tool = "run_whatif"
            args = {"events": [{"date": when.isoformat(), "multiplier": mult, "label": label}],
                    "horizon_days": 14}
            dname = _SW_DAYS[when.strftime("%A")] if lang == "sw" else when.strftime("%A")
            note = ("" if not assumed else _say(
                lang, f" Assumption: demand x{mult:g} on {dname} (you gave no size).",
                f" Dhana: mahitaji x{mult:g} siku ya {dname} (hukutaja kiwango)."))
        else:
            return _result(_say(lang,
                "Which day, and what is happening (market day or school fees)? For example: "
                "\"What if school fees are on Thursday?\"",
                "Siku gani, na nini kinatokea (siku ya soko au ada ya shule)? Mfano: "
                "\"Je kama ada ya shule ni Alhamisi?\""), [], True)
    elif _FORECAST.search(message):
        tool, args, note = "get_forecast", {"horizon_days": 7}, ""
    else:
        tool, args, note = "get_recommendation", {}, ""

    out = toolbox.call(tool, args)
    if "error" in out:
        return _result(fallback_advice([], lang), [], False, [out["error"]])
    return _result(fallback_advice([out], lang) + note, [out], True)

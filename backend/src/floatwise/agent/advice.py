"""Deterministic advice written straight from solver output, in English or Swahili.

Used as the fallback when the model's wording fails verification, so the agent can always
answer with numbers that are guaranteed to come from the tools.
Swahili wording should be reviewed by a native speaker before it goes in front of users.
"""
from __future__ import annotations

import re

_SW_DAYS = {"Monday": "Jumatatu", "Tuesday": "Jumanne", "Wednesday": "Jumatano",
            "Thursday": "Alhamisi", "Friday": "Ijumaa", "Saturday": "Jumamosi",
            "Sunday": "Jumapili"}

_SW_MARKERS = {"habari", "nina", "ninahitaji", "niongeze", "pesa", "kesho", "leo", "siku",
               "wiki", "je", "naweza", "duka", "mteja", "wateja", "soko", "ada", "shule",
               "nini", "kwa", "ni", "sina", "tafadhali", "asante", "mzigo", "taslimu"}


def detect_language(text: str) -> str:
    words = set(re.findall(r"[a-zA-Z']+", text.lower()))
    return "sw" if len(words & _SW_MARKERS) >= 2 else "en"


def _pct(p: float) -> str:
    return f"{round(p * 100)}%"


def _ksh(n: float) -> str:
    return f"KSh {int(n):,}"


def _amounts(r: dict, lang: str) -> str:
    c, f = r["add_cash_ksh"], r["add_float_ksh"]
    if lang == "sw":
        parts = ([f"{_ksh(c)} ya pesa taslimu"] if c else []) + ([f"{_ksh(f)} ya float"] if f else [])
        return " na ".join(parts)
    parts = ([f"{_ksh(c)} cash"] if c else []) + ([f"{_ksh(f)} float"] if f else [])
    return " and ".join(parts)


def recommendation_advice(rec: dict, lang: str = "en") -> str:
    r = rec.get("restock")
    risk = rec.get("p_stockout_by_day_no_restock") or []
    sw = lang == "sw"
    if r is None:
        last = risk[-1] if risk else 0.0
        n = len(risk)
        if sw:
            return (f"Hakuna siku moja ya wazi ya kuongeza mzigo. Ukiacha bila kuongeza, kuna "
                    f"uwezekano wa takriban {_pct(last)} kwamba mteja atarudishwa kufikia siku "
                    f"ya {n}. Angalia tena kesho asubuhi ukiwa na salio halisi.")
        return (f"No single restock day stands out. If you do nothing, there is about a "
                f"{_pct(last)} chance a customer is turned away by day {n}. Check again "
                f"tomorrow morning with your real balances.")
    what = _amounts(r, lang)
    day = _SW_DAYS[r["weekday"]] if sw else r["weekday"]
    risk_before = _pct(r["p_stockout_before"])
    if r["day_index"] == 0:
        if sw:
            return f"Ongeza takriban {what} leo asubuhi."
        return f"Restock about {what} this morning."
    if sw:
        return (f"Ongeza takriban {what} kufikia asubuhi ya {day}. Kuna uwezekano wa takriban "
                f"{risk_before} kwamba mteja atarudishwa bila huduma kabla ya hapo.")
    return (f"Restock about {what} by {day} morning. There is about a {risk_before} chance "
            f"a customer is turned away before then.")


def _delta_sentence(delta: dict, lang: str) -> str:
    cost = delta.get("expected_cost_ksh", 0)
    if cost == 0:
        return ""
    amt = _ksh(abs(cost))
    if lang == "sw":
        return f" Gharama inayotarajiwa {'inaongezeka' if cost > 0 else 'inapungua'} kwa {amt}."
    return f" Expected cost {'rises' if cost > 0 else 'falls'} by {amt}."


def fallback_advice(results: list[dict], lang: str = "en") -> str:
    """Best-effort advice from the most recent tool result."""
    for res in reversed(results):
        if "scenario" in res and "baseline" in res and isinstance(res["scenario"], dict):
            return recommendation_advice(res["scenario"], lang) + _delta_sentence(
                res.get("delta", {}), lang)
        if "restock" in res:
            return recommendation_advice(res, lang)
        if "days" in res and res["days"]:
            d = res["days"][-1]
            day = _SW_DAYS[d["weekday"]] if lang == "sw" else d["weekday"]
            p = _pct(d["p_stockout_by_this_day"])
            if lang == "sw":
                return (f"Bila kuongeza mzigo, kuna uwezekano wa takriban {p} kwamba mteja "
                        f"atarudishwa kufikia {day}.")
            return (f"Without restocking, there is about a {p} chance a customer is turned "
                    f"away by {day}.")
    if lang == "sw":
        return "Samahani, sijaweza kupata ushauri unaoweza kuthibitishwa. Jaribu tena."
    return "Sorry, I could not produce advice I can verify. Please try again."

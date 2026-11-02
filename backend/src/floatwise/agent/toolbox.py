"""Tool schemas the model sees, and the dispatcher that runs our code for it."""
from __future__ import annotations

from typing import Any, Callable

_HORIZON = {"type": "integer", "minimum": 1, "maximum": 30,
            "description": "Number of days to look ahead."}

TOOL_SCHEMAS: list[dict] = [
    {"type": "function", "function": {
        "name": "get_recommendation",
        "description": ("Exact optimal restocking plan for this shop: when to restock, how much, "
                        "and the stockout risk per day if it does not. Call this for any question "
                        "about when or how much to restock."),
        "parameters": {"type": "object", "properties": {"horizon_days": _HORIZON},
                       "additionalProperties": False}}},
    {"type": "function", "function": {
        "name": "get_forecast",
        "description": ("Cash and float ranges plus stockout risk for the next days if the shop "
                        "does NOT restock."),
        "parameters": {"type": "object", "properties": {"horizon_days": _HORIZON},
                       "additionalProperties": False}}},
    {"type": "function", "function": {
        "name": "run_whatif",
        "description": ("Change demand assumptions (a market day, an overall multiplier, or dated "
                        "events like school fees), re-solve, and compare with the baseline."),
        "parameters": {"type": "object", "properties": {
            "market_day": {"type": "string",
                           "description": "English weekday name, e.g. 'thursday'."},
            "demand_multiplier": {"type": "number", "exclusiveMinimum": 0},
            "events": {"type": "array", "items": {"type": "object", "properties": {
                "date": {"type": "string", "description": "YYYY-MM-DD"},
                "multiplier": {"type": "number", "exclusiveMinimum": 0},
                "label": {"type": "string"}},
                "required": ["date", "multiplier"], "additionalProperties": False}},
            "horizon_days": _HORIZON},
            "additionalProperties": False}}},
]


def _default_funcs() -> dict[str, Callable[..., dict]]:
    from floatwise.model import tools as t
    return {"get_recommendation": t.get_recommendation,
            "get_forecast": t.get_forecast,
            "run_whatif": t.run_whatif}


class Toolbox:
    """Runs tool calls against one shop's context. Never raises: errors come back as data."""

    def __init__(self, ctx: Any, funcs: dict[str, Callable[..., dict]] | None = None):
        self.ctx = ctx
        self.funcs = funcs if funcs is not None else _default_funcs()
        self.schemas = TOOL_SCHEMAS
        self._allowed = {s["function"]["name"]: set(s["function"]["parameters"]["properties"])
                         for s in TOOL_SCHEMAS}

    def call(self, name: str, arguments: dict | None) -> dict:
        arguments = arguments or {}
        if name not in self.funcs or name not in self._allowed:
            return {"error": f"unknown tool: {name}"}
        unknown = set(arguments) - self._allowed[name]
        if unknown:
            return {"error": f"unexpected arguments: {sorted(unknown)}"}
        args = dict(arguments)
        if "horizon_days" in args:
            try:
                args["horizon_days"] = max(1, min(int(args["horizon_days"]), 30))
            except (TypeError, ValueError):
                return {"error": "horizon_days must be an integer"}
        try:
            return self.funcs[name](self.ctx, **args)
        except (ValueError, KeyError, TypeError) as e:
            return {"error": f"{type(e).__name__}: {e}"}

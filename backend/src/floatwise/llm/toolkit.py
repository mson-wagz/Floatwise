from __future__ import annotations

from floatwise.model import tools as T
from floatwise.model.demand import DAY_NAMES


def clamp_int(value, lo: int, hi: int, default: int | None = None) -> int:
    """Coerce whatever the model sent into an int within [lo, hi]."""
    if value is None:
        value = lo if default is None else default
    try:
        value = int(float(value))
    except (TypeError, ValueError):
        value = lo if default is None else default
    return max(lo, min(hi, value))


TOOL_SPECS = [
    {"type": "function", "function": {
        "name": "get_recommendation",
        "description": ("Exact restocking recommendation for the shop: whether, when and how "
                        "much cash or float to add, plus the chance that at least one customer "
                        "is turned away on each day if the shop does nothing."),
        "parameters": {"type": "object", "properties": {
            "horizon_days": {"type": "integer", "minimum": 1, "maximum": 14,
                             "description": "How many days ahead to plan (default 10)."}},
            "required": []}}},
    {"type": "function", "function": {
        "name": "get_forecast",
        "description": ("Likely range (10th, 50th, 90th percentile) of cash and float balances "
                        "per day, and stockout risk, if the shop does not restock."),
        "parameters": {"type": "object", "properties": {
            "horizon_days": {"type": "integer", "minimum": 1, "maximum": 10,
                             "description": "Days to forecast (default 5)."}},
            "required": []}}},
    {"type": "function", "function": {
        "name": "run_whatif",
        "description": ("Re-run the plan under changed assumptions (a market day, a demand "
                        "change, one-off events such as school fees) and compare with the "
                        "baseline. Use for any 'what if' question."),
        "parameters": {"type": "object", "properties": {
            "market_day": {"type": "string", "enum": list(DAY_NAMES),
                           "description": "Weekday to treat as a market day."},
            "demand_multiplier": {"type": "number",
                                  "description": "Overall demand factor, e.g. 1.5 = 50% more customers."},
            "events": {"type": "array", "items": {
                "type": "object", "properties": {
                    "date": {"type": "string", "description": "ISO date, YYYY-MM-DD"},
                    "multiplier": {"type": "number"},
                    "label": {"type": "string"}},
                "required": ["date", "multiplier"]}},
            "horizon_days": {"type": "integer", "minimum": 1, "maximum": 14}},
            "required": []}}},
]


def default_tools() -> dict:
    """The real tools, with argument clamping so the model cannot ask for silly sizes."""
    def rec(ctx, horizon_days=None):
        return T.get_recommendation(ctx, clamp_int(horizon_days, 1, 14, 10))

    def fc(ctx, horizon_days=None):
        return T.get_forecast(ctx, clamp_int(horizon_days, 1, 10, 5))

    def wi(ctx, market_day=None, demand_multiplier=None, events=None, horizon_days=None):
        if demand_multiplier is not None:
            demand_multiplier = max(0.2, min(5.0, float(demand_multiplier)))
        return T.run_whatif(ctx, market_day=market_day, demand_multiplier=demand_multiplier,
                            events=events, horizon_days=clamp_int(horizon_days, 1, 14, 10))

    return {"get_recommendation": rec, "get_forecast": fc, "run_whatif": wi}
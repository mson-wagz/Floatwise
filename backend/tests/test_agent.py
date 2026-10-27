import json
from datetime import date
from types import SimpleNamespace

from floatwise.llm.agent import Agent
from floatwise.llm.toolkit import clamp_int
from floatwise.llm.verify import collect_allowed, find_unsupported
from floatwise.model.demand import ShopDemand
from floatwise.model.tools import ShopContext

CTX = ShopContext(demand=ShopDemand(), cash_ksh=60_000, float_ksh=60_000,
                  today=date(2026, 10, 27))

REC = {"restock": {"date": "2026-10-31", "weekday": "Saturday", "day_index": 4,
                   "kind": "cash", "add_cash_ksh": 22000, "add_float_ksh": 0,
                   "p_stockout_before": 0.4582},
       "p_stockout_by_day_no_restock": [0.0121, 0.1011, 0.25, 0.4582],
       "evidence": {"horizon_days": 10}}

GOOD = "Restock KSh 22,000 by Saturday 2026-10-31. About a 46% chance a customer is turned away before then."
BAD = "Restock KSh 25,000 by Saturday. About a 60% chance a customer is turned away."


def _resp(content=None, tool_calls=None):
    msg = SimpleNamespace(content=content, tool_calls=tool_calls)
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def _call(name, args=None, cid="c1"):
    return SimpleNamespace(id=cid, type="function",
                           function=SimpleNamespace(name=name, arguments=json.dumps(args or {})))


def _agent(responses, tools=None):
    queue = list(responses)
    seen = []

    def fake_chat(messages, tools=None, max_tokens=0):
        seen.append(messages)
        return queue.pop(0)
    agent = Agent(CTX, "en", chat_fn=fake_chat,
                  tools=tools if tools is not None else {"get_recommendation": lambda ctx, **k: REC})
    return agent, seen


def _allowed():
    return collect_allowed(REC, [60_000, 60_000, "2026-10-27"])


def test_verify_accepts_supported_numbers():
    nums, dates = _allowed()
    assert find_unsupported(GOOD, nums, dates) == []


def test_verify_flags_invented_numbers():
    nums, dates = _allowed()
    bad = find_unsupported(BAD, nums, dates)
    assert any("25,000" in b for b in bad) and any("60" in b for b in bad)
    assert find_unsupported("Restock on 2026-11-09.", nums, dates) == ["2026-11-09"]


def test_verify_handles_k_suffix_and_dates():
    nums, dates = _allowed()
    assert find_unsupported("Add 22k by 31 October.", nums, dates) == []
    assert find_unsupported("Add 23k.", nums, dates) == ["23k"]


def test_agent_happy_path():
    agent, _ = _agent([_resp(tool_calls=[_call("get_recommendation")]), _resp(GOOD)])
    r = agent.run("When should I restock?")
    assert r.verified and not r.used_fallback and r.retries == 0
    assert r.text == GOOD and len(r.tool_calls) == 1 and r.tool_calls[0]["ok"]


def test_agent_retries_a_bad_draft():
    agent, seen = _agent([_resp(tool_calls=[_call("get_recommendation")]),
                          _resp(BAD), _resp(GOOD)])
    r = agent.run("When should I restock?")
    assert r.verified and not r.used_fallback and r.retries == 1 and r.text == GOOD
    assert "not supported" in seen[-1][-1]["content"]


def test_agent_rejects_numbers_without_tools():
    agent, _ = _agent([_resp("You need KSh 30,000 soon."),
                       _resp(tool_calls=[_call("get_recommendation")]), _resp(GOOD)])
    r = agent.run("When should I restock?")
    assert r.retries == 1 and r.text == GOOD and len(r.tool_calls) == 1


def test_agent_falls_back_to_a_verified_template():
    agent, _ = _agent([_resp(tool_calls=[_call("get_recommendation")]),
                       _resp(BAD), _resp(BAD), _resp(BAD)])
    r = agent.run("When should I restock?")
    assert r.used_fallback and r.verified and r.retries == 2 and r.unsupported
    nums, dates = _allowed()
    assert find_unsupported(r.text, nums, dates) == []
    assert "22,000" in r.text


def test_unknown_tool_does_not_crash():
    agent, _ = _agent([_resp(tool_calls=[_call("delete_everything")]),
                       _resp("I could not look that up.")])
    r = agent.run("Do something odd")
    assert r.tool_calls[0]["ok"] is False and r.text == "I could not look that up."


def test_tool_arguments_are_clamped():
    assert clamp_int("20", 1, 14) == 14
    assert clamp_int(None, 1, 14, default=10) == 10
    assert clamp_int("abc", 1, 14, default=7) == 7
    assert clamp_int(0, 1, 14) == 1
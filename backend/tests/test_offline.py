from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pytest

from floatwise.agent import Toolbox, verify_advice
from floatwise.agent import resilient
from floatwise.agent.client import ChatResponse
from floatwise.agent.fake import ScriptedClient, text, tool_call
from floatwise.agent.offline import run_offline
from floatwise.agent.providers import Provider, build_chain
from floatwise.agent.resilient import AllModelsFailed, ResilientClient, run_chat
from floatwise import connectivity

TODAY = date(2026, 10, 28)   # a Wednesday

REC = {
    "as_of": "2026-10-28", "balances": {"cash_ksh": 60000, "float_ksh": 60000},
    "restock": {"date": "2026-10-31", "weekday": "Saturday", "day_index": 3, "kind": "cash",
                "add_cash_ksh": 22000, "add_float_ksh": 0, "p_stockout_before": 0.4582,
                "p_plan_restocks_this_day": 0.3797, "p_plan_restocks_by_then": 0.6485},
    "p_stockout_by_day_no_restock": [0.0121, 0.1011, 0.25, 0.4582, 0.7019],
    "expected_cost_ksh": 5400}
SCEN = {**REC, "restock": {**REC["restock"], "add_cash_ksh": 19000, "p_stockout_before": 0.5749},
        "p_stockout_by_day_no_restock": [0.0121, 0.1011, 0.3995, 0.5749, 0.7675],
        "expected_cost_ksh": 5710}
WHATIF = {"baseline": REC, "scenario": SCEN, "assumptions_changed": ["x"],
          "delta": {"expected_cost_ksh": 310, "p_stockout_at_horizon_no_restock": 0.06}}
FORECAST = {"as_of": "2026-10-28", "days": [
    {"date": "2026-10-29", "weekday": "Thursday", "p_stockout_by_this_day": 0.25,
     "cash_p10_ksh": 4000, "cash_p50_ksh": 32000, "cash_p90_ksh": 75000,
     "float_p10_ksh": 1000, "float_p50_ksh": 20000, "float_p90_ksh": 60000}]}


def box(calls=None):
    def mk(name, result):
        def f(ctx, **kw):
            if calls is not None:
                calls.append((name, kw))
            return result
        return f
    return Toolbox(ctx=SimpleNamespace(today=TODAY), funcs={
        "get_recommendation": mk("get_recommendation", REC),
        "get_forecast": mk("get_forecast", FORECAST),
        "run_whatif": mk("run_whatif", WHATIF)})


# ---------------- offline router ----------------
def test_offline_recommendation_in_english_and_swahili():
    for q, word in (("When should I restock cash?", "Saturday"), ("Niongeze pesa lini?", "Jumamosi")):
        calls: list = []
        r = run_offline(box(calls), q)
        assert r.source == "offline" and r.verified and word in r.text
        assert calls[0][0] == "get_recommendation"
        assert verify_advice(r.text, r.tool_results).ok


def test_offline_school_fees_uses_next_thursday_and_states_its_assumption():
    calls: list = []
    r = run_offline(box(calls), "What if school fees are on Thursday?")
    name, kw = calls[0]
    assert name == "run_whatif"
    assert kw["events"] == [{"date": "2026-10-29", "multiplier": 1.8, "label": "school fees"}]
    assert "Assumption: demand x1.8" in r.text and "Thursday" in r.text
    assert verify_advice(r.text.split(" Assumption")[0], r.tool_results).ok


def test_offline_same_weekday_means_next_week():
    calls: list = []
    run_offline(box(calls), "What if school fees are on Wednesday?")
    assert calls[0][1]["events"][0]["date"] == "2026-11-04"


def test_offline_swahili_market_day():
    calls: list = []
    r = run_offline(box(calls), "Je kama soko ni Alhamisi?")
    assert calls[0] == ("run_whatif", {"market_day": "thursday", "horizon_days": 14})
    assert r.source == "offline" and "Gharama" in r.text


def test_offline_explicit_multiplier_has_no_assumption_note():
    calls: list = []
    r = run_offline(box(calls), "What if demand doubles on Friday?")
    assert calls[0][1]["events"][0]["multiplier"] == 2.0 and "Assumption" not in r.text
    calls.clear()
    run_offline(box(calls), "what if fees on friday at 1.5x")
    assert calls[0][1]["events"][0]["multiplier"] == 1.5


def test_offline_whatif_without_a_day_asks_instead_of_guessing():
    calls: list = []
    r = run_offline(box(calls), "What if school fees come?")
    assert calls == [] and "Which day" in r.text
    r = run_offline(box(calls), "Je kama ada ya shule inakuja?")
    assert calls == [] and "Siku gani" in r.text


def test_offline_forecast_intent():
    calls: list = []
    r = run_offline(box(calls), "Give me the forecast for the next few days")
    assert calls[0][0] == "get_forecast" and "Thursday" in r.text


def test_offline_tool_error_is_reported_not_raised():
    tb = Toolbox(ctx=SimpleNamespace(today=TODAY),
                 funcs={"get_recommendation": lambda ctx, **kw: (_ for _ in ()).throw(ValueError("capacity"))})
    r = run_offline(tb, "When should I restock?")
    assert not r.verified and r.problems and "capacity" in r.problems[0]


# ---------------- failover ----------------
class Boom:
    def chat(self, messages, tools):
        raise ConnectionError("no route")


def _chain(*specs):
    return [Provider(n, c, remote, "m") for n, c, remote in specs]


@pytest.fixture
def online(monkeypatch):
    monkeypatch.setattr(resilient, "is_online", lambda: True)


@pytest.fixture
def offline(monkeypatch):
    monkeypatch.setattr(resilient, "is_online", lambda: False)


def test_failover_uses_the_next_provider(online):
    good = ScriptedClient([text("hello")])
    rc = ResilientClient(_chain(("meta", Boom(), True), ("fireworks", good, True)))
    assert rc.chat([], []).content == "hello" and rc.last_used == "fireworks"


def test_a_failed_provider_is_skipped_during_cooldown(online):
    failing, good = Boom(), ScriptedClient([text("a"), text("b")])
    rc = ResilientClient(_chain(("meta", failing, True), ("fw", good, True)), cooldown=60)
    rc.chat([], [])
    assert "meta" in rc._down
    rc.chat([], [])   # meta not retried; fw answers again
    assert rc.last_used == "fw"


def test_all_providers_failing_raises_with_every_reason(online):
    rc = ResilientClient(_chain(("meta", Boom(), True), ("fw", Boom(), True)))
    with pytest.raises(AllModelsFailed) as e:
        rc.chat([], [])
    assert [n for n, _ in e.value.errors] == ["meta", "fw"]


def test_offline_skips_remote_providers_but_not_local(offline):
    remote, local = ScriptedClient([text("remote")]), ScriptedClient([text("local")])
    rc = ResilientClient(_chain(("meta", remote, True), ("local", local, False)))
    assert rc.chat([], []).content == "local"
    assert remote.calls == []


def test_run_chat_uses_the_model_when_it_works(online):
    good = ScriptedClient([tool_call("get_recommendation"),
                           text("Restock about KSh 22,000 cash by Saturday morning. "
                                "There is about a 46% chance a customer is turned away before then.")])
    r = run_chat(box(), "When should I restock?", _chain(("meta", good, True)))
    assert r.source == "model" and r.provider == "meta" and r.verified


def test_run_chat_falls_back_to_offline_when_every_model_fails(online):
    r = run_chat(box(), "When should I restock?", _chain(("meta", Boom(), True)))
    assert r.source == "offline" and r.provider == "" and "Saturday" in r.text


def test_run_chat_with_no_providers_is_offline(offline):
    r = run_chat(box(), "Niongeze pesa lini?", [])
    assert r.source == "offline" and "Jumamosi" in r.text


def test_run_chat_offline_with_only_remote_models_never_calls_them(offline):
    remote = ScriptedClient([text("should not be used")])
    r = run_chat(box(), "When should I restock?", _chain(("meta", remote, True)))
    assert r.source == "offline" and remote.calls == []


# ---------------- providers and connectivity ----------------
@pytest.fixture
def fake_client(monkeypatch):
    made = []

    class C:
        def __init__(self, **kw):
            made.append(kw)
    monkeypatch.setattr("floatwise.agent.providers.OpenAICompatClient", C)
    return made


def test_build_chain_skips_providers_without_keys(fake_client):
    chain = build_chain(env={"MODEL_API_KEY": "k1", "FIREWORKS_API_KEY": "k2"})
    assert [p.name for p in chain] == ["meta", "fireworks"]
    assert fake_client[0]["model"] == "muse-spark-1.3" and fake_client[0]["max_retries"] == 0
    assert fake_client[1]["model"] == "accounts/fireworks/models/muse-spark-open"


def test_build_chain_local_needs_a_model_name(fake_client):
    assert build_chain("local", env={}) == []
    chain = build_chain("local", env={"LOCAL_LLM_MODEL": "glimmer", "LOCAL_BASE_URL": "http://x/v1"})
    assert chain[0].remote is False and fake_client[0]["base_url"] == "http://x/v1"
    assert fake_client[0]["timeout"] == 120.0


def test_build_chain_order_and_unknown_names(fake_client):
    chain = build_chain("baseten,meta", env={"BASETEN_API_KEY": "b", "MODEL_API_KEY": "m"})
    assert [p.name for p in chain] == ["baseten", "meta"]
    with pytest.raises(ValueError):
        build_chain("openai", env={})


def test_offline_switch(monkeypatch):
    monkeypatch.setenv("FLOATWISE_OFFLINE", "1")
    assert connectivity.offline_forced() and connectivity.is_online() is False
    monkeypatch.delenv("FLOATWISE_OFFLINE")
    assert connectivity.offline_forced() is False


# ---------------- modal provider and pinned chat functions ----------------
def test_modal_needs_url_key_and_model(fake_client):
    assert build_chain("modal", env={"MODAL_API_KEY": "k"}) == []
    assert build_chain("modal", env={"MODAL_API_KEY": "k", "MODAL_BASE_URL": "https://x/v1"}) == []
    chain = build_chain("modal", env={"MODAL_API_KEY": "k", "MODAL_BASE_URL": "https://x/v1",
                                      "MODAL_MODEL": "muse-spark-open"})
    assert [p.name for p in chain] == ["modal"] and fake_client[0]["base_url"] == "https://x/v1"


def test_chat_fn_for_is_pinned_to_one_provider(monkeypatch):
    from floatwise.agent.providers import chat_fn_for

    class C:
        def __init__(self, **kw):
            self.kw = kw

        def complete(self, messages, **kw):
            return ("raw", self.kw["model"], messages, kw)
    monkeypatch.setattr("floatwise.agent.providers.OpenAICompatClient", C)
    fn = chat_fn_for("fireworks", env={"FIREWORKS_API_KEY": "k"})
    assert fn([{"role": "user", "content": "hi"}], max_tokens=10) == (
        "raw", "accounts/fireworks/models/muse-spark-open", [{"role": "user", "content": "hi"}],
        {"max_tokens": 10})
    assert chat_fn_for("fireworks", env={}) is None

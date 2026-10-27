from datetime import date
from types import SimpleNamespace

import pytest

from floatwise.store import ShopStore

RECV = ("XYZ987ABCD Confirmed. You have received Ksh5,000.00 from JANE DOE 254712345678 "
        "on 27/10/26 at 11:35 AM. New M-PESA balance is Ksh150,200.00.")
BANK = ("QQQ222BBBB Confirmed. Ksh50,000.00 received from BANK LTD 254700000000 "
        "on 27/10/26 at 9:15 AM.")
TID = "sms_XYZ987ABCD"


def _store(cash=60_000, flt=60_000):
    s = ShopStore()
    return s, s.create_shop("Test shop", cash_ksh=cash, float_ksh=flt).shop_id


def test_ingest_is_pending_and_changes_nothing():
    s, sid = _store()
    b = s.ingest_sms(sid, RECV)
    assert b.status == "pending_confirmation" and len(b.transactions) == 1
    assert (s.get(sid).cash_ksh, s.get(sid).float_ksh) == (60_000, 60_000)


def test_confirm_commits_and_trusts_the_phone_balance():
    s, sid = _store()
    b = s.ingest_sms(sid, RECV)
    out = s.confirm(sid, b.id)
    assert out["committed"] == 1 and out["float_source"] == "sms_balance"
    assert out["balances"]["cash_ksh"] == 55_000
    assert out["balances"]["float_ksh"] == 150_200
    assert len(s.get(sid).transactions) == 1


def test_edit_recomputes_deltas_and_warns_about_the_phone_balance():
    s, sid = _store()
    b = s.ingest_sms(sid, RECV)
    out = s.confirm(sid, b.id, edits=[{"id": TID, "amount_ksh": 4000}])
    assert out["float_source"] == "deltas"
    assert (out["balances"]["cash_ksh"], out["balances"]["float_ksh"]) == (56_000, 64_000)
    assert any("last message" in w for w in out["warnings"])


def test_removed_transactions_are_not_committed():
    s, sid = _store()
    b = s.ingest_sms(sid, RECV)
    out = s.confirm(sid, b.id, removed_ids=[TID])
    assert out["committed"] == 0 and out["balances"]["cash_ksh"] == 60_000
    assert s.get(sid).transactions == []


def test_a_message_pasted_twice_is_only_committed_once():
    s, sid = _store()
    s.confirm(sid, s.ingest_sms(sid, RECV).id)
    out = s.confirm(sid, s.ingest_sms(sid, RECV).id)
    assert out["committed"] == 0 and out["skipped_duplicates"] == 1
    assert out["balances"]["cash_ksh"] == 55_000


def test_reject_changes_nothing():
    s, sid = _store()
    b = s.ingest_sms(sid, RECV)
    assert s.reject(sid, b.id)["status"] == "rejected"
    assert s.get(sid).cash_ksh == 60_000
    with pytest.raises(ValueError):
        s.confirm(sid, b.id)


def test_a_batch_cannot_be_confirmed_twice():
    s, sid = _store()
    b = s.ingest_sms(sid, RECV)
    s.confirm(sid, b.id)
    with pytest.raises(ValueError):
        s.confirm(sid, b.id)


def test_unknown_ids_are_rejected():
    s, sid = _store()
    b = s.ingest_sms(sid, RECV)
    with pytest.raises(ValueError):
        s.confirm(sid, b.id, removed_ids=["nope"])
    with pytest.raises(KeyError):
        s.get("shop_999")


def test_negative_cash_is_clamped_with_a_warning():
    s, sid = _store(cash=1_000, flt=1_000)
    out = s.confirm(sid, s.ingest_sms(sid, RECV).id)
    assert out["balances"]["cash_ksh"] == 0
    assert any("Cash would be negative" in w for w in out["warnings"])


def test_context_uses_defaults_when_history_is_short():
    s, sid = _store(40_000, 40_000)
    ctx, info = s.context(sid, today=date(2026, 10, 27))
    assert info["fitted"] is False and "Default" in info["note"]
    assert (ctx.cash_ksh, ctx.float_ksh) == (40_000, 40_000)


def test_context_refuses_a_shop_above_model_capacity():
    s, sid = _store()
    s.confirm(sid, s.ingest_sms(sid, RECV).id)   # 55,000 cash + 150,200 float
    with pytest.raises(ValueError, match="capacity"):
        s.context(sid)


def test_llm_fallback_results_need_review():
    answer = ('[{"type": "float_purchase", "amount_ksh": 50000, '
              '"timestamp": "2026-10-27T09:15"}]')
    msg = SimpleNamespace(content=answer, tool_calls=None)
    resp = SimpleNamespace(choices=[SimpleNamespace(message=msg)])
    s, sid = _store()
    b = s.ingest_sms(sid, BANK, use_llm=True, chat_fn=lambda m, **k: resp)
    assert len(b.transactions) == 1 and b.transactions[0].needs_review
    assert b.unparsed == []
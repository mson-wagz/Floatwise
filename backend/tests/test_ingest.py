import json
from types import SimpleNamespace

from floatwise.ingest.anonymize import redact
from floatwise.ingest.llm_extract import extract_with_llm
from floatwise.ingest.sms_parser import parse_sms_text

SENT = ("ABCDE12345 Confirmed. Ksh5,000.00 sent to JOHN DOE 254701234567 on 27/10/26 at "
        "11:30 AM. New M-PESA balance is Ksh145,200.00. Transaction cost, Ksh0.00.")
RECV = ("XYZ987ABCD Confirmed. You have received Ksh5,000.00 from JANE DOE 254712345678 "
        "on 27/10/26 at 11:35 AM. New M-PESA balance is Ksh150,200.00.")


def _fake(content, seen=None):
    msg = SimpleNamespace(content=content, tool_calls=None)
    resp = SimpleNamespace(choices=[SimpleNamespace(message=msg)])

    def fn(messages, **kw):
        if seen is not None:
            seen.append(messages)
        return resp
    return fn


def test_sent_is_a_customer_deposit():
    t = parse_sms_text(SENT).transactions[0]
    assert t.type.value == "deposit" and t.amount_ksh == 5000
    assert (t.cash_delta_ksh, t.float_delta_ksh) == (5000, -5000)
    assert t.timestamp.isoformat() == "2026-10-27T11:30:00+03:00"


def test_received_is_a_customer_withdrawal():
    t = parse_sms_text(RECV).transactions[0]
    assert t.type.value == "withdrawal"
    assert (t.cash_delta_ksh, t.float_delta_ksh) == (-5000, 5000)
    assert t.needs_review is False


def test_labels_and_backticks_are_ignored_and_balances_chain():
    text = ("Deposit text : " + SENT + "      Withdrawal texts: A. Cash Receipt Message:\n`"
            + RECV + "`")
    r = parse_sms_text(text)
    assert len(r.transactions) == 2 and r.unparsed == [] and r.warnings == []
    assert r.float_balance_ksh == 150_200


def test_no_personal_data_is_kept():
    r = parse_sms_text(SENT + "\n" + RECV)
    dump = json.dumps([t.model_dump(mode="json") for t in r.transactions])
    for secret in ("JOHN", "JANE", "254701234567", "0701234567", "254712345678"):
        assert secret not in dump


def test_a_missing_message_is_detected():
    r = parse_sms_text(SENT + "\n" + RECV.replace("Ksh150,200.00", "Ksh160,200.00"))
    assert any("missing" in w for w in r.warnings)


def test_duplicates_are_ignored():
    r = parse_sms_text(SENT + "\n" + SENT)
    assert len(r.transactions) == 1 and any("Duplicate" in w for w in r.warnings)


def test_unknown_format_is_reported_not_guessed():
    r = parse_sms_text("ZZZ111AAAA Confirmed. Ksh200.00 paid to SOME SHOP for goods.")
    assert r.transactions == [] and len(r.unparsed) == 1


def test_large_incoming_amounts_are_flagged_for_review():
    r = parse_sms_text(RECV.replace("Ksh5,000.00", "Ksh45,000.00"))
    assert r.transactions[0].needs_review is True


def test_redact_removes_names_and_phones():
    out = redact(SENT)
    assert "JOHN" not in out and "254701234567" not in out and "[PHONE]" in out


def test_llm_fallback_extracts_and_flags_for_review():
    seen = []
    chunk = ("QQQ222BBBB Confirmed. Ksh50,000.00 received from BANK LTD 254700000000 "
             "on 27/10/26 at 9:15 AM.")
    answer = ('```json\n[{"type": "float_purchase", "amount_ksh": 50000, '
              '"timestamp": "2026-10-27T09:15"}]\n```')
    txns, left = extract_with_llm([chunk], chat_fn=_fake(answer, seen))
    assert left == [] and len(txns) == 1
    t = txns[0]
    assert t.type.value == "float_purchase" and t.float_delta_ksh == 50_000
    assert t.cash_delta_ksh == 0 and t.needs_review is True
    sent_text = seen[0][1]["content"]
    assert "254700000000" not in sent_text and "BANK" not in sent_text


def test_llm_fallback_with_a_bad_answer_leaves_the_message_unparsed():
    txns, left = extract_with_llm(["something odd"], chat_fn=_fake("sorry, I cannot help"))
    assert txns == [] and left == ["something odd"]
from datetime import datetime
from types import SimpleNamespace

from fastapi.testclient import TestClient

import floatwise.api.app as api_module
from floatwise.api.app import app
from floatwise.ingest.sms_parser import TZ
from floatwise.ingest.text_extract import extract_from_narration

NOW = datetime(2026, 10, 27, 12, 0, tzinfo=TZ)
ANSWER = ('[{"type": "withdrawal", "amount_ksh": 5000, "date": null},'
          '{"type": "float_purchase", "amount_ksh": 10000, "date": null}]')


def _fake(content):
    msg = SimpleNamespace(content=content, tool_calls=None)
    resp = SimpleNamespace(choices=[SimpleNamespace(message=msg)])
    return lambda messages, **kw: resp


def test_narration_becomes_pending_transactions():
    txns = extract_from_narration("nimetoa elfu tano, nimepokea float elfu kumi", NOW,
                                  chat_fn=_fake(ANSWER))
    assert [t.type.value for t in txns] == ["withdrawal", "float_purchase"]
    assert all(t.needs_review and t.source.value == "voice" for t in txns)
    assert (txns[1].cash_delta_ksh, txns[1].float_delta_ksh) == (0, 10_000)


def test_bad_rows_are_dropped():
    bad = '[{"type": "withdrawal", "amount_ksh": "lots"}, {"type": "nonsense", "amount_ksh": 5}]'
    assert extract_from_narration("x", NOW, chat_fn=_fake(bad)) == []


def test_voice_endpoint_then_confirm(monkeypatch):
    monkeypatch.setattr(api_module.elevenlabs, "transcribe", lambda *a, **k: "elfu tano")
    monkeypatch.setattr(api_module, "extract_from_narration",
                        lambda text: extract_from_narration(text, NOW, chat_fn=_fake(ANSWER)))
    c = TestClient(app)
    sid = c.post("/api/shops", json={"name": "T", "cash_ksh": 40000,
                                     "float_ksh": 40000}).json()["shop_id"]
    r = c.post(f"/api/shops/{sid}/voice", files={"audio": ("v.webm", b"123", "audio/webm")},
               data={"language": "sw"})
    assert r.status_code == 200
    b = r.json()
    assert b["transcript"] == "elfu tano" and len(b["transactions"]) == 2
    out = c.post(f"/api/shops/{sid}/batches/{b['batch_id']}/confirm", json={}).json()
    assert out["balances"] == {**out["balances"], "cash_ksh": 35000, "float_ksh": 55000}


def test_speak_returns_audio(monkeypatch):
    monkeypatch.setattr(api_module.elevenlabs, "speak", lambda text: b"MP3DATA")
    r = TestClient(app).post("/api/speak", json={"text": "Habari"})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"
    assert r.content == b"MP3DATA"

def test_voice_chat_returns_transcript_and_answer(monkeypatch):
    calls = {"n": 0}

    def fake_chat(messages, **kw):
        calls["n"] += 1
        if calls["n"] == 1:
            tc = SimpleNamespace(id="c1", function=SimpleNamespace(
                name="get_recommendation", arguments="{}"))
            msg = SimpleNamespace(content="", tool_calls=[tc])
        else:
            msg = SimpleNamespace(content="No restock is needed soon.", tool_calls=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])

    real_agent = api_module.Agent
    monkeypatch.setattr(api_module, "Agent",
                        lambda ctx, language: real_agent(ctx, language, chat_fn=fake_chat))
    monkeypatch.setattr(api_module.elevenlabs, "transcribe",
                        lambda *a, **k: "Nifanye nini leo?")

    c = TestClient(app)
    sid = c.post("/api/shops", json={"name": "T", "cash_ksh": 40000,
                                     "float_ksh": 40000}).json()["shop_id"]
    r = c.post(f"/api/shops/{sid}/voice-chat",
               files={"audio": ("q.webm", b"123", "audio/webm")}, data={"language": "sw"})
    assert r.status_code == 200
    body = r.json()
    assert body["transcript"] == "Nifanye nini leo?" and body["verified"] is True
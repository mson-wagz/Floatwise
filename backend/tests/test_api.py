from fastapi.testclient import TestClient
from floatwise.api.app import app
from types import SimpleNamespace
import floatwise.api.app as api_module



RECV = ("XYZ987ABCD Confirmed. You have received Ksh5,000.00 from JANE DOE 254712345678 "
        "on 27/10/26 at 11:35 AM. New M-PESA balance is Ksh50,200.00.")


def test_full_flow():
    c = TestClient(app)
    sid = c.post("/api/shops", json={"name": "T", "cash_ksh": 60000,
                                     "float_ksh": 45000}).json()["shop_id"]
    b = c.post(f"/api/shops/{sid}/sms", json={"text": RECV}).json()
    assert b["status"] == "pending_confirmation" and len(b["transactions"]) == 1
    out = c.post(f"/api/shops/{sid}/batches/{b['batch_id']}/confirm", json={}).json()
    assert out["balances"]["float_ksh"] == 50200
    assert c.get(f"/api/shops/{sid}/recommendation?horizon_days=7").status_code == 200


def test_errors_are_json():
    c = TestClient(app)
    assert c.get("/api/shops/nope").status_code == 404
    assert c.post("/api/shops", json={"name": "x", "cash_ksh": -1}).status_code == 422


def _tool_call(name, args="{}"):
    return SimpleNamespace(id="call_1", function=SimpleNamespace(name=name, arguments=args))


def test_chat_endpoint_with_a_fake_model(monkeypatch):
    calls = {"n": 0}

    def fake_chat(messages, **kw):
        calls["n"] += 1
        if calls["n"] == 1:   # first turn: the model asks for the recommendation
            msg = SimpleNamespace(content="", tool_calls=[_tool_call("get_recommendation")])
        else:                 # second turn: it answers with no numbers, so it verifies
            msg = SimpleNamespace(content="No restock is needed soon.", tool_calls=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])

    real_agent = api_module.Agent
    monkeypatch.setattr(api_module, "Agent",
                        lambda ctx, language: real_agent(ctx, language, chat_fn=fake_chat))

    c = TestClient(app)
    sid = c.post("/api/shops", json={"name": "T", "cash_ksh": 40000,
                                     "float_ksh": 40000}).json()["shop_id"]
    r = c.post(f"/api/shops/{sid}/chat", json={"question": "When should I restock?"})
    assert r.status_code == 200
    body = r.json()
    assert body["verified"] is True and body["tool_calls"][0]["name"] == "get_recommendation"
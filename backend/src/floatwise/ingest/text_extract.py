from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime

from floatwise.ingest.anonymize import redact
from floatwise.ingest.sms_parser import TZ
from floatwise.llm.client import chat as default_chat
from floatwise.schema import Source, Transaction, TxnType, apply_deltas

_PROMPT = (
    "You read what a mobile money agent in Kenya says or writes about their day, in "
    "Swahili or English. Return ONLY a JSON array with one object per transaction:\n"
    '  "type": withdrawal, deposit, float_purchase, cash_banking or other\n'
    '  "amount_ksh": integer. Convert number words exactly (elfu tano = 5000, '
    "elfu kumi = 10000, laki moja = 100000).\n"
    '  "date": "YYYY-MM-DD" only if a date is stated, otherwise null\n'
    "withdrawal = a customer took cash out (cash down, float up). deposit = a customer "
    "handed in cash (cash up, float down). float_purchase = the agent bought e-float. "
    "cash_banking = the agent moved physical cash to or from a bank. Use other if unsure. "
    "Never invent an amount that was not said or written. Ignore names and phone numbers. "
    "If nothing is a transaction, return [].")


def _json_array(text: str) -> list:
    s, e = text.find("["), text.rfind("]")
    if s == -1 or e <= s:
        raise ValueError("no JSON array in the answer")
    return json.loads(text[s:e + 1])


def _rows_to_txns(rows: list, now: datetime, key: str, source: Source) -> list:
    out = []
    for i, row in enumerate(rows):
        try:
            kind = TxnType(row["type"])
            amount = int(round(float(row["amount_ksh"])))
            if row.get("date"):
                d = datetime.strptime(row["date"], "%Y-%m-%d")
                ts = d.replace(hour=12, tzinfo=TZ)
            else:
                ts = now
            dc, df = apply_deltas(kind, amount)
            out.append(Transaction(
                id=f"{source.value}_{key}_{i}", timestamp=ts, type=kind, amount_ksh=amount,
                commission_ksh=0, cash_delta_ksh=dc, float_delta_ksh=df, source=source,
                confidence=0.6, needs_review=True))
        except Exception:
            continue   # a bad row is dropped, never guessed
    return out


def _key(payload: bytes, now: datetime) -> str:
    # The time is part of the id, so saying the same thing on another day is not a duplicate.
    return hashlib.sha1(payload + now.isoformat().encode()).hexdigest()[:8]


def extract_from_narration(text: str, now: datetime | None = None, chat_fn=None) -> list:
    """Transcript -> pending transactions. Only redacted text reaches the model."""
    now = now or datetime.now(TZ)
    chat_fn = chat_fn or default_chat
    resp = chat_fn([{"role": "system", "content": _PROMPT},
                    {"role": "user", "content": redact(text)}], max_tokens=4000)
    rows = _json_array(resp.choices[0].message.content or "")
    return _rows_to_txns(rows, now, _key(text.encode(), now), Source.voice)


def extract_from_image(image: bytes, mime: str = "image/jpeg", now: datetime | None = None,
                       chat_fn=None) -> list:
    """Photo of a ledger page -> pending transactions.
    UNTESTED against your provider: it needs a chat model that accepts images.
    Names written on the page cannot be redacted before the model sees them."""
    now = now or datetime.now(TZ)
    chat_fn = chat_fn or default_chat
    url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
    resp = chat_fn([{"role": "system", "content": _PROMPT},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Read this ledger page."},
                        {"type": "image_url", "image_url": {"url": url}}]}],
                   max_tokens=4000)
    rows = _json_array(resp.choices[0].message.content or "")
    return _rows_to_txns(rows, now, _key(image, now), Source.ledger)
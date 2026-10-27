from __future__ import annotations

import hashlib
import json
from datetime import datetime

from floatwise.ingest.anonymize import redact
from floatwise.ingest.sms_parser import TZ
from floatwise.llm.client import chat as default_chat
from floatwise.schema import Source, Transaction, TxnType, apply_deltas

_PROMPT = (
    "You read M-Pesa agent messages that a rule-based parser could not handle. "
    "Messages may be Swahili or English; names and phone numbers are already removed.\n"
    "Return ONLY a JSON array with one object per transaction, using the keys:\n"
    '  "type": one of withdrawal, deposit, float_purchase, cash_banking, other\n'
    '  "amount_ksh": integer\n'
    '  "timestamp": "YYYY-MM-DDTHH:MM" in Nairobi time, or null if the message has none\n'
    "withdrawal = customer took cash out (agent received float). deposit = customer handed "
    "in cash (agent sent float). float_purchase = agent bought e-float. cash_banking = agent "
    "moved physical cash to or from a bank. Use other if unsure. Never guess an amount or "
    "date that is not in the text. If nothing is a transaction, return [].")


def _json_array(text: str) -> list:
    s, e = text.find("["), text.rfind("]")
    if s == -1 or e <= s:
        raise ValueError("no JSON array in the answer")
    return json.loads(text[s:e + 1])


def extract_with_llm(chunks: list[str], chat_fn=None) -> tuple[list, list]:
    """Returns (transactions, still_unparsed). Every transaction needs human review."""
    chat_fn = chat_fn or default_chat
    txns, unparsed = [], []
    for chunk in chunks:
        try:
            resp = chat_fn([{"role": "system", "content": _PROMPT},
                            {"role": "user", "content": redact(chunk)}], max_tokens=4000)
            rows = _json_array(resp.choices[0].message.content or "")
        except Exception:
            unparsed.append(chunk)
            continue
        made = 0
        for i, row in enumerate(rows):
            try:
                kind = TxnType(row["type"])
                amount = int(round(float(row["amount_ksh"])))
                ts = datetime.strptime(row["timestamp"], "%Y-%m-%dT%H:%M").replace(tzinfo=TZ)
                dc, df = apply_deltas(kind, amount)
                txns.append(Transaction(
                    id=f"llm_{hashlib.sha1(chunk.encode()).hexdigest()[:8]}_{i}",
                    timestamp=ts, type=kind, amount_ksh=amount, commission_ksh=0,
                    cash_delta_ksh=dc, float_delta_ksh=df, source=Source.sms,
                    confidence=0.6, needs_review=True))
                made += 1
            except Exception:
                continue
        if made == 0:
            unparsed.append(chunk)
    return txns, unparsed
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo

from floatwise.ingest.anonymize import hash_phone
from floatwise.schema import Source, Transaction, TxnType, apply_deltas

TZ = ZoneInfo("Africa/Nairobi")
REVIEW_ABOVE_KSH = 30_000   # large amounts may be float top-ups, not customers

_AMT = r"Ksh\s?(?P<amount>[\d,]+(?:\.\d{1,2})?)"
_WHO = r"(?P<name>.+?)\s+(?P<phone>(?:\+?254|0)[17]\d{8})\s+"
_TAIL = (r"on\s+(?P<date>\d{1,2}/\d{1,2}/\d{2,4})\s+at\s+(?P<time>\d{1,2}:\d{2}\s?[AaPp][Mm])\.?"
         r"\s*New M-PESA balance is Ksh\s?(?P<balance>[\d,]+(?:\.\d{1,2})?)\.?"
         r"(?:\s*Transaction cost,?\s*Ksh\s?(?P<cost>[\d,]+(?:\.\d{1,2})?)\.?)?")
_HEAD = r"(?P<code>[A-Z0-9]{10})\s+Confirmed\.\s*"

# Agent SENT float to a customer -> customer deposit (cash in, float out).
SENT = re.compile(_HEAD + _AMT + r"\s+sent to\s+" + _WHO + _TAIL, re.S)
# Agent RECEIVED float from a customer -> customer withdrawal (cash out, float in).
RECEIVED = re.compile(_HEAD + r"You have received\s+" + _AMT + r"\s+from\s+" + _WHO + _TAIL, re.S)
_SPLIT = re.compile(r"(?=\b[A-Z0-9]{10}\s+Confirmed\.)")


@dataclass
class SmsParseResult:
    transactions: list = field(default_factory=list)
    unparsed: list = field(default_factory=list)
    float_balance_ksh: int | None = None   # M-PESA balance after the latest message
    warnings: list = field(default_factory=list)


def _ksh(s: str) -> float:
    return float(s.replace(",", ""))


def _parse_ts(date_s: str, time_s: str) -> datetime:
    d, m, y = date_s.split("/")
    year = int(y) + 2000 if len(y) == 2 else int(y)
    t = re.sub(r"\s*([AaPp][Mm])", r" \1", time_s.strip()).upper()
    parsed = datetime.strptime(t, "%I:%M %p")
    return datetime(year, int(m), int(d), parsed.hour, parsed.minute, tzinfo=TZ)


def _parse_one(chunk: str, salt: str):
    for pattern, kind in ((SENT, TxnType.deposit), (RECEIVED, TxnType.withdrawal)):
        m = pattern.search(chunk)
        if not m:
            continue
        amount = int(round(_ksh(m["amount"])))
        dc, df = apply_deltas(kind, amount)
        txn = Transaction(
            id=f"sms_{m['code']}", timestamp=_parse_ts(m["date"], m["time"]), type=kind,
            amount_ksh=amount, commission_ksh=0, cash_delta_ksh=dc, float_delta_ksh=df,
            counterparty_hash=hash_phone(m["phone"], salt), source=Source.sms,
            confidence=0.95, needs_review=amount >= REVIEW_ABOVE_KSH)
        balance = int(round(_ksh(m["balance"])))
        cost = int(round(_ksh(m["cost"]))) if m["cost"] else 0
        return txn, balance, cost
    return None


def parse_sms_text(text: str, salt: str = "floatwise-demo") -> SmsParseResult:
    """Parse pasted M-Pesa messages. Labels and stray text around messages are ignored.
    Anything that looks like a message but matches no pattern goes to `unparsed`."""
    res = SmsParseResult()
    seen: set = set()
    items = []
    for chunk in _SPLIT.split(text):
        chunk = chunk.strip()
        if "Confirmed" not in chunk and "Ksh" not in chunk:
            continue
        try:
            parsed = _parse_one(chunk, salt)
        except (ValueError, KeyError):
            parsed = None
        if parsed is None:
            res.unparsed.append(chunk[:300])
            continue
        txn, balance, cost = parsed
        if txn.id in seen:
            res.warnings.append(f"Duplicate message {txn.id} ignored.")
            continue
        seen.add(txn.id)
        items.append((txn.timestamp, len(items), txn, balance, cost))

    # Messages in the same minute keep the pasted order, which can be newest-first,
    # so a same-minute pair can raise a false balance warning.
    items.sort(key=lambda x: (x[0], x[1]))
    prev = None
    for _, _, txn, balance, cost in items:
        res.transactions.append(txn)
        if prev is not None:
            expected = prev + txn.float_delta_ksh - cost
            if abs(expected - balance) > 1:
                res.warnings.append(
                    f"Balance after {txn.id} is KSh {balance:,}, but the previous message "
                    f"implies KSh {expected:,}. A message may be missing between them.")
        prev = balance
    if items:
        res.float_balance_ksh = items[-1][3]
    return res
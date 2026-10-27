import sys

sys.stdout.reconfigure(encoding="utf-8")

from floatwise.ingest.llm_extract import extract_with_llm
from floatwise.ingest.sms_parser import parse_sms_text

TEXT = """
ABCDE12345 Confirmed. Ksh5,000.00 sent to JOHN DOE 254701234567 on 27/10/26 at 11:30 AM. New M-PESA balance is Ksh145,200.00. Transaction cost, Ksh0.00.
XYZ987ABCD Confirmed. You have received Ksh5,000.00 from JANE DOE 254712345678 on 27/10/26 at 11:35 AM. New M-PESA balance is Ksh150,200.00.
ZZZ111AAAA Confirmed. Ksh200.00 paid to SOME SHOP for goods on 27/10/26 at 12:00 PM.
"""

r = parse_sms_text(TEXT)
for t in r.transactions:
    print(t.timestamp.isoformat(), t.type.value, t.amount_ksh,
          "cash", f"{t.cash_delta_ksh:+}", "float", f"{t.float_delta_ksh:+}",
          "review" if t.needs_review else "", t.counterparty_hash)
print("float balance:", r.float_balance_ksh)
print("warnings:", r.warnings)
print("unparsed:", r.unparsed)

if "--llm" in sys.argv and r.unparsed:
    txns, left = extract_with_llm(r.unparsed)
    print("\nFALLBACK extracted:", [(t.type.value, t.amount_ksh) for t in txns])
    print("still unparsed:", left)
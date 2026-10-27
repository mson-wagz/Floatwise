import json
import sys
from datetime import date

sys.stdout.reconfigure(encoding="utf-8")

from floatwise.model.tools import get_recommendation
from floatwise.store import ShopStore

TEXT = """
ABCDE12345 Confirmed. Ksh5,000.00 sent to JOHN DOE 254701234567 on 27/10/26 at 11:30 AM. New M-PESA balance is Ksh45,200.00. Transaction cost, Ksh0.00.
XYZ987ABCD Confirmed. You have received Ksh5,000.00 from JANE DOE 254712345678 on 27/10/26 at 11:35 AM. New M-PESA balance is Ksh50,200.00.
ZZZ111AAAA Confirmed. Ksh200.00 paid to SOME SHOP for goods on 27/10/26 at 12:00 PM.
"""

store = ShopStore()
shop = store.create_shop("Mama Njeri Agency", cash_ksh=60_000, float_ksh=45_000)
print("before:", shop.cash_ksh, shop.float_ksh)

batch = store.ingest_sms(shop.shop_id, TEXT)
print("pending:", [(t.id, t.type.value, t.amount_ksh, t.needs_review) for t in batch.transactions])
print("unparsed:", batch.unparsed, "| warnings:", batch.warnings)
print("balances still:", shop.cash_ksh, shop.float_ksh)

out = store.confirm(shop.shop_id, batch.id)
print("\nconfirmed:", json.dumps(out, indent=2))

ctx, info = store.context(shop.shop_id, today=date(2026, 10, 27))
print("\ncontext info:", info)
rec = get_recommendation(ctx, horizon_days=10)
print("recommendation:", json.dumps(rec["restock"], indent=2))
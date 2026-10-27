from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from datetime import date, datetime

from floatwise.ingest.llm_extract import extract_with_llm
from floatwise.ingest.sms_parser import TZ, parse_sms_text
from floatwise.model.demand import ShopDemand
from floatwise.model.fit import fit_demand
from floatwise.model.grid import MAX_TOTAL_UNITS, UNIT_KSH
from floatwise.model.tools import ShopContext
from floatwise.schema import Transaction, TxnType, apply_deltas

PENDING = "pending_confirmation"


@dataclass
class Batch:
    id: str
    shop_id: str
    source: str
    transactions: list
    unparsed: list
    warnings: list
    float_balance_ksh: int | None
    status: str = PENDING
    committed: int = 0


@dataclass
class Shop:
    shop_id: str
    name: str
    language: str
    market_days: tuple
    payday_dates: tuple
    cash_ksh: int
    float_ksh: int
    as_of: datetime
    transactions: list = field(default_factory=list)
    batches: dict = field(default_factory=dict)
    seen_ids: set = field(default_factory=set)


def _edited(t: Transaction, edit: dict) -> Transaction:
    kind = TxnType(edit.get("type", t.type.value))
    amount = int(edit.get("amount_ksh", t.amount_ksh))
    if amount <= 0:
        raise ValueError("amount_ksh must be positive")
    dc, df = apply_deltas(kind, amount)
    return t.model_copy(update=dict(type=kind, amount_ksh=amount, cash_delta_ksh=dc,
                                    float_delta_ksh=df, needs_review=False, confidence=1.0))


class ShopStore:
    """In-memory store, enough for the hackathon. Swap for a database later."""

    def __init__(self):
        self.shops: dict[str, Shop] = {}
        self._shop_ids = itertools.count(1)
        self._batch_ids = itertools.count(1)

    def _shop(self, shop_id: str) -> Shop:
        try:
            return self.shops[shop_id]
        except KeyError:
            raise KeyError(f"unknown shop: {shop_id}") from None

    def _batch(self, shop: Shop, batch_id: str) -> Batch:
        try:
            return shop.batches[batch_id]
        except KeyError:
            raise KeyError(f"unknown batch: {batch_id}") from None

    def create_shop(self, name: str, language: str = "sw", cash_ksh: int = 0,
                    float_ksh: int = 0, market_days=("saturday",), payday_dates=(25, 30),
                    now: datetime | None = None) -> Shop:
        if cash_ksh < 0 or float_ksh < 0:
            raise ValueError("balances must be non-negative")
        shop = Shop(f"shop_{next(self._shop_ids)}", name, language, tuple(market_days),
                    tuple(payday_dates), int(cash_ksh), int(float_ksh),
                    now or datetime.now(TZ))
        self.shops[shop.shop_id] = shop
        return shop

    def get(self, shop_id: str) -> Shop:
        return self._shop(shop_id)

    def set_balances(self, shop_id: str, cash_ksh: int, float_ksh: int,
                     now: datetime | None = None) -> Shop:
        if cash_ksh < 0 or float_ksh < 0:
            raise ValueError("balances must be non-negative")
        shop = self._shop(shop_id)
        shop.cash_ksh, shop.float_ksh = int(cash_ksh), int(float_ksh)
        shop.as_of = now or datetime.now(TZ)
        return shop

    def ingest_sms(self, shop_id: str, text: str, use_llm: bool = False,
                   chat_fn=None) -> Batch:
        shop = self._shop(shop_id)
        res = parse_sms_text(text)
        txns, unparsed = list(res.transactions), list(res.unparsed)
        if use_llm and unparsed:
            extra, unparsed = extract_with_llm(unparsed, chat_fn=chat_fn)
            txns = sorted(txns + extra, key=lambda t: t.timestamp)
        batch = Batch(f"batch_{next(self._batch_ids)}", shop_id, "sms", txns, unparsed,
                      list(res.warnings), res.float_balance_ksh)
        shop.batches[batch.id] = batch
        return batch

    def confirm(self, shop_id: str, batch_id: str, edits: list | None = None,
                removed_ids: list | None = None, now: datetime | None = None) -> dict:
        shop = self._shop(shop_id)
        batch = self._batch(shop, batch_id)
        if batch.status != PENDING:
            raise ValueError(f"batch is already {batch.status}")
        edit_map = {e["id"]: e for e in (edits or [])}
        removed = set(removed_ids or [])
        unknown = (set(edit_map) | removed) - {t.id for t in batch.transactions}
        if unknown:
            raise ValueError(f"unknown transaction ids: {sorted(unknown)}")

        keep, skipped = [], 0
        for t in batch.transactions:
            if t.id in removed:
                continue
            if t.id in edit_map:
                t = _edited(t, edit_map[t.id])
            if t.id in shop.seen_ids:
                skipped += 1
                continue
            keep.append(t)

        warnings = []
        cash = shop.cash_ksh + sum(t.cash_delta_ksh for t in keep)
        by_deltas = shop.float_ksh + sum(t.float_delta_ksh for t in keep)
        changed = bool(edit_map or removed)
        if batch.float_balance_ksh is not None and keep and not changed and skipped == 0:
            flt, source = batch.float_balance_ksh, "sms_balance"
        else:
            flt, source = by_deltas, "deltas"
            if batch.float_balance_ksh is not None and keep \
                    and abs(flt - batch.float_balance_ksh) > 1:
                warnings.append(
                    f"After your changes the float is KSh {flt:,}, but the last message "
                    f"shows KSh {batch.float_balance_ksh:,}. Correct it if the phone is right.")
        if cash < 0:
            warnings.append("Cash would be negative, so it was set to KSh 0. "
                            "Check your cash balance and correct it.")
            cash = 0
        if flt < 0:
            warnings.append("Float would be negative, so it was set to KSh 0. "
                            "Check your float balance and correct it.")
            flt = 0

        shop.transactions = sorted(shop.transactions + keep, key=lambda t: t.timestamp)
        shop.seen_ids.update(t.id for t in keep)
        shop.cash_ksh, shop.float_ksh = int(cash), int(flt)
        shop.as_of = now or datetime.now(TZ)
        batch.status, batch.committed = "confirmed", len(keep)
        return {"batch_id": batch.id, "status": "confirmed", "committed": len(keep),
                "skipped_duplicates": skipped, "float_source": source,
                "warnings": warnings,
                "balances": {"cash_ksh": shop.cash_ksh, "float_ksh": shop.float_ksh,
                             "as_of": shop.as_of.isoformat()}}

    def reject(self, shop_id: str, batch_id: str) -> dict:
        shop = self._shop(shop_id)
        batch = self._batch(shop, batch_id)
        if batch.status != PENDING:
            raise ValueError(f"batch is already {batch.status}")
        batch.status = "rejected"
        return {"batch_id": batch.id, "status": "rejected"}

    def context(self, shop_id: str, today: date | None = None) -> tuple[ShopContext, dict]:
        """Build what the tools need. Fits demand to the shop's history when there is
        enough of it (30+ customers over a week or more), otherwise uses defaults."""
        shop = self._shop(shop_id)
        today = today or date.today()
        cap = MAX_TOTAL_UNITS * UNIT_KSH
        total = shop.cash_ksh + shop.float_ksh
        if total > cap:
            raise ValueError(f"Cash plus float (KSh {total:,}) is above the model "
                             f"capacity of KSh {cap:,}.")
        cust = [t for t in shop.transactions
                if t.type in (TxnType.withdrawal, TxnType.deposit)]
        span = ((max(t.timestamp for t in cust) - min(t.timestamp for t in cust)).days + 1
                if cust else 0)
        demand, info = None, {"fitted": False}
        if len(cust) >= 30 and span >= 7:
            try:
                demand, fit_info = fit_demand(shop.transactions, shop.market_days,
                                              shop.payday_dates)
                info = {"fitted": True, **fit_info}
            except ValueError:
                demand = None
        if demand is None:
            demand = ShopDemand(market_days=shop.market_days, payday_dates=shop.payday_dates)
            info["note"] = ("Default assumptions: not enough history yet "
                            "(needs 30+ customers over at least a week).")
        return ShopContext(demand=demand, cash_ksh=shop.cash_ksh, float_ksh=shop.float_ksh,
                           today=today), info

    def add_batch(self, shop_id: str, source: str, txns: list,
                  unparsed: list | None = None, warnings: list | None = None) -> Batch:
        shop = self._shop(shop_id)
        batch = Batch(f"batch_{next(self._batch_ids)}", shop_id, source,
                      sorted(txns, key=lambda t: t.timestamp), list(unparsed or []),
                      list(warnings or []), None)
        shop.batches[batch.id] = batch
        return batch
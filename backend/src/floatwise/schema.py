from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TxnType(str, Enum):
    withdrawal = "withdrawal"          # customer takes cash: cash down, float up
    deposit = "deposit"                # customer hands cash: cash up, float down
    float_purchase = "float_purchase"  # agent buys e-float: float up
    cash_banking = "cash_banking"      # agent banks cash or restocks cash
    other = "other"


class Source(str, Enum):
    sms = "sms"
    voice = "voice"
    ledger = "ledger"
    manual = "manual"
    synthetic = "synthetic"


class Language(str, Enum):
    sw = "sw"
    en = "en"


class Balances(BaseModel):
    cash_ksh: int = Field(..., description="Physical cash in the till, KSh")
    float_ksh: int = Field(..., description="Digital e-float balance, KSh")
    as_of: datetime


class Transaction(BaseModel):
    id: str
    timestamp: datetime
    type: TxnType
    amount_ksh: int = Field(..., gt=0)
    commission_ksh: int = Field(0, ge=0)
    cash_delta_ksh: int
    float_delta_ksh: int
    counterparty_hash: str | None = None
    source: Source = Source.manual
    confidence: float = Field(1.0, ge=0, le=1)
    needs_review: bool = False


class ShopProfile(BaseModel):
    shop_id: str
    name: str
    language: Language = Language.sw
    market_days: list[str] = Field(default_factory=list)
    payday_dates: list[int] = Field(default_factory=list)
    opening: Balances


class Advice(BaseModel):
    text: str
    language: Language
    kind: str = Field(..., description="cash | float | both | none")
    stockout_probability: float = Field(..., ge=0, le=1)
    probability_range: tuple[float, float] | None = None
    restock_by: datetime | None = None
    restock_amount_ksh: int = 0
    expected_loss_ksh: int = 0
    verified: bool = False
    evidence: dict = Field(default_factory=dict)


def apply_deltas(txn_type: TxnType, amount: int) -> tuple[int, int]:
    """Return (cash_delta, float_delta). Single source of truth for balance moves."""
    if txn_type == TxnType.withdrawal:
        return -amount, +amount
    if txn_type == TxnType.deposit:
        return +amount, -amount
    if txn_type == TxnType.float_purchase:
        return 0, +amount
    if txn_type == TxnType.cash_banking:
        return +amount, 0
    return 0, 0
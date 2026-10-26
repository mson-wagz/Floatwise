from pydantic import BaseModel
from typing import List, Optional

class Transaction(BaseModel):
    id: int
    amount: float
    date: str
    description: str
    shop_id: int

class ShopState(BaseModel):
    shop_id: int
    inventory: List[str]
    cash_balance: float
    transactions: List[Transaction]

class Plan(BaseModel):
    shop_id: int
    restock_threshold: float
    restock_amount: float
    sales_forecast: List[float]  # Forecasted sales for the upcoming days
    budget: float  # Budget allocated for restocking
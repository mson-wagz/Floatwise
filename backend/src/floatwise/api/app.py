from __future__ import annotations

import threading
from contextlib import asynccontextmanager
from datetime import date, datetime
from fastapi import FastAPI, Request, Depends, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from floatwise.ingest.sms_parser import TZ
from floatwise.model import tools
from floatwise.store import Batch, Shop, ShopStore
from floatwise.llm.agent import Agent
import httpx
from floatwise.ingest.text_extract import extract_from_image, extract_from_narration
from floatwise.voice import elevenlabs
from fastapi_jwt import JwtAccessBearer
import os
from dotenv import load_dotenv

# Initialize JWT
jwt = JwtAccessBearer(secret_key=os.getenv("JWT_SECRET", "your-secret-key"))

# Load environment variables
load_dotenv()

store = ShopStore()
_store_lock = threading.RLock()   # protects the in-memory store
_model_lock = threading.Lock()    # the model caches are plain dicts, so solve one at a time


@asynccontextmanager
async def lifespan(app: FastAPI):
    tools._space()   # build the state space once, so the first request isn't slow
    yield


app = FastAPI(title="FloatWise API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # add your deployed frontend
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- errors: the store raises KeyError (not found) and ValueError (bad input) ----
@app.exception_handler(KeyError)
async def _not_found(_: Request, exc: KeyError):
    return JSONResponse(status_code=404, content={"error": str(exc.args[0])})


@app.exception_handler(ValueError)
async def _bad_input(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"error": str(exc)})

@app.exception_handler(RuntimeError)
async def _not_configured(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"error": str(exc)})


@app.exception_handler(httpx.HTTPError)
async def _upstream(_: Request, exc: httpx.HTTPError):
    return JSONResponse(status_code=502, content={"error": f"voice service failed: {exc}"})


# ---- request bodies ----
class ShopCreate(BaseModel):
    name: str
    language: str = "sw"
    cash_ksh: int = Field(0, ge=0)
    float_ksh: int = Field(0, ge=0)
    market_days: list[str] = ["saturday"]
    payday_dates: list[int] = [25, 30]


class BalancesIn(BaseModel):
    cash_ksh: int = Field(ge=0)
    float_ksh: int = Field(ge=0)


class SmsIn(BaseModel):
    text: str
    use_llm: bool = False


class EditIn(BaseModel):
    id: str
    type: str | None = None
    amount_ksh: int | None = None


class ConfirmIn(BaseModel):
    edits: list[EditIn] = []
    removed_ids: list[str] = []


class EventIn(BaseModel):
    date: date
    multiplier: float = Field(gt=0)
    label: str = "event"


class WhatIfIn(BaseModel):
    market_day: str | None = None
    demand_multiplier: float | None = Field(None, gt=0)
    events: list[EventIn] = []
    horizon_days: int = Field(14, ge=1, le=30)


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatIn(BaseModel):
    question: str = Field(min_length=1)
    language: str | None = None          # "sw" or "en"; defaults to the shop's language
    history: list[ChatMessage] = []

class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=800)

class User(BaseModel):
    email: str
    password: str

class Chat(BaseModel):
    user_email: str
    message: str


# ---- serializers ----
def _shop(s: Shop) -> dict:
    return {"shop_id": s.shop_id, "name": s.name, "language": s.language,
            "market_days": list(s.market_days), "payday_dates": list(s.payday_dates),
            "cash_ksh": s.cash_ksh, "float_ksh": s.float_ksh,
            "as_of": s.as_of.isoformat(), "transaction_count": len(s.transactions)}


def _batch(b: Batch) -> dict:
    return {"batch_id": b.id, "shop_id": b.shop_id, "status": b.status,
            "transactions": [t.model_dump(mode="json") for t in b.transactions],
            "unparsed": b.unparsed, "warnings": b.warnings,
            "float_balance_ksh": b.float_balance_ksh, "committed": b.committed}


def _today() -> date:
    return datetime.now(TZ).date()


def _context(shop_id: str):
    with _store_lock:
        return store.context(shop_id, today=_today())
    
def _chat_payload(reply, info: dict) -> dict:
    return {"text": reply.text, "verified": reply.verified,
            "used_fallback": reply.used_fallback, "retries": reply.retries,
            "language": reply.language, "tool_calls": reply.tool_calls,
            "unsupported_numbers": reply.unsupported, "demand_model": info}


# ---- endpoints ----
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/shops", status_code=201)
def create_shop(body: ShopCreate):
    with _store_lock:
        return _shop(store.create_shop(**body.model_dump()))


@app.get("/api/shops/{shop_id}")
def get_shop(shop_id: str):
    with _store_lock:
        return _shop(store.get(shop_id))


@app.put("/api/shops/{shop_id}/balances")
def set_balances(shop_id: str, body: BalancesIn):
    with _store_lock:
        return _shop(store.set_balances(shop_id, body.cash_ksh, body.float_ksh))


@app.get("/api/shops/{shop_id}/transactions")
def list_transactions(shop_id: str, limit: int = 100):
    with _store_lock:
        txns = store.get(shop_id).transactions[-limit:]
        return {"transactions": [t.model_dump(mode="json") for t in reversed(txns)]}


@app.post("/api/shops/{shop_id}/sms")
def ingest_sms(shop_id: str, body: SmsIn):
    with _store_lock:
        return _batch(store.ingest_sms(shop_id, body.text, use_llm=body.use_llm))


@app.get("/api/shops/{shop_id}/batches/{batch_id}")
def get_batch(shop_id: str, batch_id: str):
    with _store_lock:
        return _batch(store._batch(store.get(shop_id), batch_id))


@app.post("/api/shops/{shop_id}/batches/{batch_id}/confirm")
def confirm_batch(shop_id: str, batch_id: str, body: ConfirmIn):
    with _store_lock:
        return store.confirm(shop_id, batch_id,
                             edits=[e.model_dump(exclude_none=True) for e in body.edits],
                             removed_ids=body.removed_ids)


@app.post("/api/shops/{shop_id}/batches/{batch_id}/reject")
def reject_batch(shop_id: str, batch_id: str):
    with _store_lock:
        return store.reject(shop_id, batch_id)


@app.get("/api/shops/{shop_id}/recommendation")
def recommendation(shop_id: str, horizon_days: int = 14):
    ctx, info = _context(shop_id)
    with _model_lock:
        rec = tools.get_recommendation(ctx, horizon_days)
    return {**rec, "demand_model": info}


@app.get("/api/shops/{shop_id}/forecast")
def forecast(shop_id: str, horizon_days: int = 7):
    ctx, info = _context(shop_id)
    with _model_lock:
        out = tools.get_forecast(ctx, horizon_days)
    return {**out, "demand_model": info}


@app.post("/api/shops/{shop_id}/whatif")
def whatif(shop_id: str, body: WhatIfIn):
    ctx, info = _context(shop_id)
    with _model_lock:
        out = tools.run_whatif(
            ctx, market_day=body.market_day, demand_multiplier=body.demand_multiplier,
            events=[{"date": e.date.isoformat(), "multiplier": e.multiplier, "label": e.label}
                    for e in body.events],
            horizon_days=body.horizon_days)
    return {**out, "demand_model": info}


@app.post("/api/shops/{shop_id}/chat")
def chat(shop_id: str, body: ChatIn):
    ctx, info = _context(shop_id)
    with _store_lock:
        language = body.language or store.get(shop_id).language
    if language not in ("sw", "en"):
        raise ValueError("language must be 'sw' or 'en'")

    history = [m.model_dump() for m in body.history if m.role in ("user", "assistant")]

    agent = Agent(ctx, language=language)
    with _model_lock:
        reply = agent.run(body.question, history=history)

    return _chat_payload(reply, info)


@app.post("/signup")
async def signup(user: User):
    existing_user = supabase.table("users").select("*").eq("email", user.email).execute()
    if existing_user.data:
        raise HTTPException(status_code=400, detail="User already exists")

    supabase.table("users").insert({"email": user.email, "password": user.password}).execute()
    return {"message": "User created successfully"}


@app.post("/login")
async def login(user: User):
    result = supabase.table("users").select("*").eq("email", user.email).execute()
    if not result.data or result.data[0]["password"] != user.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = jwt.create_access_token(subject=user.email)
    return {"access_token": access_token}


@app.post("/chats")
async def save_chat(chat: Chat):
    supabase.table("chats").insert({"user_email": chat.user_email, "message": chat.message}).execute()
    return {"message": "Chat saved successfully"}


@app.get("/chats/{user_email}")
async def get_chats(user_email: str):
    result = supabase.table("chats").select("*").eq("user_email", user_email).execute()
    return {"chats": result.data}
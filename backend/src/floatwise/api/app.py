from __future__ import annotations

import logging
import os
import secrets
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv

# Load .env BEFORE anything reads os.getenv (the JWT secret, Supabase keys, ...).
load_dotenv()

from fastapi import (APIRouter, Depends, FastAPI, File, Form, HTTPException, Request,
                     UploadFile)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from floatwise.ingest.sms_parser import TZ
from floatwise.ingest.text_extract import extract_from_image, extract_from_narration  # noqa: F401
from floatwise.llm.agent import Agent
from floatwise.model import tools
from floatwise.store import Batch, Shop, ShopStore
from floatwise.voice import elevenlabs
from floatwise.model.replay import replay_month

# Optional pieces: the app still starts without them, and the routes that need
# them answer 503 with a clear message instead of crashing at import time.
try:
    import bcrypt
except ImportError:  # pragma: no cover
    bcrypt = None
try:
    from jose import JWTError
    from jose import jwt as jose_jwt
except ImportError:  # pragma: no cover
    jose_jwt = None

    class JWTError(Exception):
        pass
try:
    from supabase import create_client
except ImportError:  # pragma: no cover
    create_client = None

log = logging.getLogger("floatwise")

# ---- settings (all from the environment, never hard-coded) ----
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().strip('"').strip("'")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip().strip('"').strip("'")
supabase = None
if create_client and SUPABASE_URL.startswith("http") and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:   # a bad URL or key must not stop the whole app
        log.warning("Supabase is disabled: %s", exc)
elif SUPABASE_URL or SUPABASE_KEY:
    log.warning("Supabase is disabled: SUPABASE_URL must start with https:// "
                "and SUPABASE_KEY must be set.")

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_urlsafe(32)
    log.warning("JWT_SECRET is not set: using a random one, so tokens stop working "
                "whenever the server restarts. Set JWT_SECRET in .env.")
JWT_HOURS = 12

# Off by default so the demo and the tests work without logging in.
# Set REQUIRE_AUTH=1 on any deployed server, and have the frontend send
# "Authorization: Bearer <token>".
REQUIRE_AUTH = os.getenv("REQUIRE_AUTH", "0") == "1"

ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if o.strip()]

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
    allow_origins=ALLOWED_ORIGINS,
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


# ---- authentication ----
bearer = HTTPBearer(auto_error=False)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str | None:
    """Email from a valid token. A bad token is always rejected; a missing token is
    rejected only when REQUIRE_AUTH=1."""
    if creds is None:
        if REQUIRE_AUTH:
            raise HTTPException(status_code=401, detail="Log in first")
        return None
    if jose_jwt is None:
        raise RuntimeError("Login is not available: python-jose is not installed")
    try:
        payload = jose_jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
    return payload.get("email")


def require_user(email: str | None = Depends(current_user)) -> str:
    if not email:
        raise HTTPException(status_code=401, detail="Log in first")
    return email


def _db():
    if supabase is None:
        raise RuntimeError("Accounts are not configured: set SUPABASE_URL and SUPABASE_KEY")
    return supabase


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


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class SavedChat(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


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


def _add_batch(shop_id: str, source: str, txns: list, unparsed: list) -> Batch:
    """Create a pending batch. Uses store.add_batch when the store has it, and
    otherwise builds the batch the same way ShopStore.ingest_sms does."""
    if hasattr(store, "add_batch"):
        return store.add_batch(shop_id, source, txns, unparsed=unparsed)
    shop = store.get(shop_id)
    batch = Batch(f"batch_{next(store._batch_ids)}", shop_id, source,
                  list(txns), list(unparsed), [], None)
    shop.batches[batch.id] = batch
    return batch


def _chat_payload(reply, info: dict) -> dict:
    return {"text": reply.text, "verified": reply.verified,
            "used_fallback": reply.used_fallback, "retries": reply.retries,
            "language": reply.language, "tool_calls": reply.tool_calls,
            "unsupported_numbers": reply.unsupported, "demand_model": info}


# ---- public endpoints ----
@app.get("/api/health")
def health():
    return {"status": "ok", "auth_required": REQUIRE_AUTH, "accounts": supabase is not None}


@app.post("/signup", status_code=201)
def signup(body: Credentials):
    if bcrypt is None:
        raise RuntimeError("Signup is not available: bcrypt is not installed")
    db = _db()
    email = body.email.strip().lower()
    if db.table("users").select("email").eq("email", email).execute().data:
        raise HTTPException(status_code=400, detail="User already exists")
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    db.table("users").insert({"email": email, "password": hashed}).execute()
    return {"message": "User created successfully"}


@app.post("/login")
def login(body: Credentials):
    if bcrypt is None or jose_jwt is None:
        raise RuntimeError("Login is not available: bcrypt or python-jose is not installed")
    email = body.email.strip().lower()
    rows = _db().table("users").select("*").eq("email", email).execute().data
    ok = False
    if rows:
        try:
            ok = bcrypt.checkpw(body.password.encode(), rows[0]["password"].encode())
        except ValueError:   # an old plain-text password row: never matches
            ok = False
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    exp = datetime.now(timezone.utc) + timedelta(hours=JWT_HOURS)
    token = jose_jwt.encode({"email": email, "exp": exp}, JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}


# ---- saved chats (only for the logged-in user, taken from the token) ----
@app.post("/chats", status_code=201)
def save_chat(body: SavedChat, email: str = Depends(require_user)):
    _db().table("chats").insert({"user_email": email, "message": body.message}).execute()
    return {"message": "Chat saved successfully"}


@app.get("/chats")
def get_chats(email: str = Depends(require_user)):
    rows = _db().table("chats").select("*").eq("user_email", email).execute().data
    return {"chats": rows}


@app.get("/chats/{user_email}")
def get_chats_for(user_email: str, email: str = Depends(require_user)):
    # Kept for older clients, but you can only read your own history.
    if user_email.strip().lower() != email:
        raise HTTPException(status_code=403, detail="You can only read your own chats")
    return get_chats(email)


# ---- shop endpoints: all behind current_user (enforced when REQUIRE_AUTH=1) ----
api = APIRouter(prefix="/api", dependencies=[Depends(current_user)])


@api.post("/shops", status_code=201)
def create_shop(body: ShopCreate):
    with _store_lock:
        return _shop(store.create_shop(**body.model_dump()))


@api.get("/shops/{shop_id}")
def get_shop(shop_id: str):
    with _store_lock:
        return _shop(store.get(shop_id))


@api.put("/shops/{shop_id}/balances")
def set_balances(shop_id: str, body: BalancesIn):
    with _store_lock:
        return _shop(store.set_balances(shop_id, body.cash_ksh, body.float_ksh))


@api.get("/shops/{shop_id}/transactions")
def list_transactions(shop_id: str, limit: int = 100):
    with _store_lock:
        txns = store.get(shop_id).transactions[-limit:]
        return {"transactions": [t.model_dump(mode="json") for t in reversed(txns)]}


@api.post("/shops/{shop_id}/sms")
def ingest_sms(shop_id: str, body: SmsIn):
    def chat_fn_for(key: str):
        # Define the function or import it from the correct module
        return None  # Replace with actual implementation if needed

    open_chat = chat_fn_for("fireworks")   # None without a key: the default chain is used
    with _store_lock:
        return _batch(store.ingest_sms(shop_id, body.text, use_llm=body.use_llm,
                                       chat_fn=open_chat))


@api.get("/shops/{shop_id}/batches/{batch_id}")
def get_batch(shop_id: str, batch_id: str):
    with _store_lock:
        return _batch(store._batch(store.get(shop_id), batch_id))


@api.post("/shops/{shop_id}/batches/{batch_id}/confirm")
def confirm_batch(shop_id: str, batch_id: str, body: ConfirmIn):
    with _store_lock:
        return store.confirm(shop_id, batch_id,
                             edits=[e.model_dump(exclude_none=True) for e in body.edits],
                             removed_ids=body.removed_ids)


@api.post("/shops/{shop_id}/batches/{batch_id}/reject")
def reject_batch(shop_id: str, batch_id: str):
    with _store_lock:
        return store.reject(shop_id, batch_id)


@api.get("/shops/{shop_id}/recommendation")
def recommendation(shop_id: str, horizon_days: int = 14):
    ctx, info = _context(shop_id)
    with _model_lock:
        rec = tools.get_recommendation(ctx, horizon_days)
    return {**rec, "demand_model": info}


@api.get("/shops/{shop_id}/forecast")
def forecast(shop_id: str, horizon_days: int = 7):
    ctx, info = _context(shop_id)
    with _model_lock:
        out = tools.get_forecast(ctx, horizon_days)
    return {**out, "demand_model": info}


@api.post("/shops/{shop_id}/whatif")
def whatif(shop_id: str, body: WhatIfIn):
    ctx, info = _context(shop_id)
    with _model_lock:
        out = tools.run_whatif(
            ctx, market_day=body.market_day, demand_multiplier=body.demand_multiplier,
            events=[{"date": e.date.isoformat(), "multiplier": e.multiplier, "label": e.label}
                    for e in body.events],
            horizon_days=body.horizon_days)
    return {**out, "demand_model": info}


@api.post("/shops/{shop_id}/chat")
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


@api.post("/shops/{shop_id}/voice")
def voice(shop_id: str, audio: UploadFile = File(...), language: str | None = Form(None)):
    with _store_lock:
        lang = language or store.get(shop_id).language
    data = audio.file.read()
    if not data:
        raise ValueError("the audio file is empty")
    transcript = elevenlabs.transcribe(data, audio.filename or "voice.webm",
                                       audio.content_type or "audio/webm", lang)
    if not transcript:
        raise ValueError("no speech was recognised in the recording")
    try:
        txns = extract_from_narration(transcript)
    except ValueError:
        txns = []
    with _store_lock:
        batch = _add_batch(shop_id, "voice", txns, [] if txns else [transcript])
        return {**_batch(batch), "transcript": transcript}


@api.post("/speak")
def speak(body: SpeakIn):
    return Response(content=elevenlabs.speak(body.text), media_type="audio/mpeg")


@api.post("/shops/{shop_id}/voice-chat")
def voice_chat(shop_id: str, audio: UploadFile = File(...), language: str | None = Form(None)):
    ctx, info = _context(shop_id)
    with _store_lock:
        lang = language or store.get(shop_id).language
    if lang not in ("sw", "en"):
        raise ValueError("language must be 'sw' or 'en'")
    data = audio.file.read()
    if not data:
        raise ValueError("the audio file is empty")

    transcript = elevenlabs.transcribe(data, audio.filename or "voice.webm",
                                       audio.content_type or "audio/webm", lang)
    if not transcript:
        raise ValueError("no speech was recognised in the recording")

    agent = Agent(ctx, language=lang)
    with _model_lock:
        reply = agent.run(transcript)
    return {"transcript": transcript, **_chat_payload(reply, info)}

@api.get("/shops/{shop_id}/replay")
def replay(shop_id: str, days: int = 30):
    ctx, info = _context(shop_id)
    with _model_lock:
        out = replay_month(ctx, days)
    return {**out, "demand_model": info}


@api.post("/shops/{shop_id}/ledger-image")
def ledger_image(shop_id: str, image: UploadFile = File(...)):
    data = image.file.read()
    if not data:
        raise ValueError("the image file is empty")
    try:
        txns = extract_from_image(data, image.content_type or "image/jpeg")  # adjust args
    except ValueError:
        txns = []
    with _store_lock:
        batch = _add_batch(shop_id, "image", txns, [] if txns else ["unreadable ledger photo"])
        return _batch(batch)


app.include_router(api)
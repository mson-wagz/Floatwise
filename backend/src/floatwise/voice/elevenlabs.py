from __future__ import annotations

import httpx

from floatwise.config import settings

_BASE = "https://api.elevenlabs.io/v1"


def _headers() -> dict:
    if not settings.elevenlabs_api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set. Check backend/.env")
    return {"xi-api-key": settings.elevenlabs_api_key}


def transcribe(audio: bytes, filename: str = "voice.webm",
               content_type: str = "audio/webm", language: str | None = None) -> str:
    """Speech to text with ElevenLabs Scribe. language: 'sw', 'en' or None (auto-detect)."""
    data = {"model_id": settings.elevenlabs_stt_model}
    if language:
        data["language_code"] = language
    r = httpx.post(f"{_BASE}/speech-to-text", headers=_headers(), data=data,
                   files={"file": (filename, audio, content_type)}, timeout=90)
    r.raise_for_status()
    return (r.json().get("text") or "").strip()


def speak(text: str) -> bytes:
    """Text to speech. Returns MP3 bytes."""
    if not settings.elevenlabs_voice_id:
        raise RuntimeError("ELEVENLABS_VOICE_ID is not set. Check backend/.env")
    r = httpx.post(f"{_BASE}/text-to-speech/{settings.elevenlabs_voice_id}",
                   headers=_headers(), params={"output_format": "mp3_44100_128"},
                   json={"text": text, "model_id": settings.elevenlabs_tts_model}, timeout=60)
    r.raise_for_status()
    return r.content
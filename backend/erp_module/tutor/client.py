"""Free LLM providers behind one OpenAI-compatible client.

Gemini answers first: in testing it gave a written answer every time and got facts such as the direction of
the rejection threshold right, and it can see plot images. Groq is the backup, used when Gemini is at its
free-tier limit or unavailable, or when it is the only key set. Keys are read from the environment on every
call, so adding a key to .env and restarting is enough. GROQ_BASE_URL / GEMINI_BASE_URL can point either slot
at another OpenAI-compatible server.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from openai import OpenAI

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
# Groq retires models often (llama-3.3-70b-versatile went in 2026); TUTOR_TEXT_MODEL overrides this.
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


@dataclass(frozen=True)
class Provider:
    name: str
    base_url: str
    api_key: str
    model: str
    vision: bool


def _groq() -> Provider | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    model = os.environ.get("TUTOR_TEXT_MODEL", "").strip() or DEFAULT_GROQ_MODEL
    base = os.environ.get("GROQ_BASE_URL", "").strip() or GROQ_BASE_URL
    return Provider("groq", base, key, model, vision=False) if key else None


def _gemini() -> Provider | None:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    model = os.environ.get("TUTOR_VISION_MODEL", "").strip() or DEFAULT_GEMINI_MODEL
    base = os.environ.get("GEMINI_BASE_URL", "").strip() or GEMINI_BASE_URL
    return Provider("gemini", base, key, model, vision=True) if key else None


def providers() -> list[Provider]:
    """The providers with a key, in the order to try them: Gemini, then Groq as the backup."""
    return [p for p in (_gemini(), _groq()) if p]


def route() -> Provider | None:
    found = providers()
    return found[0] if found else None


def status() -> dict:
    found = providers()
    vision = next((p for p in found if p.vision), None)
    return {
        "enabled": bool(found),
        "text_provider": found[0].name if found else None,
        "backup_provider": found[1].name if len(found) > 1 else None,
        "vision_provider": vision.name if vision else None,
    }


def make_client(provider: Provider, max_retries: int = 3) -> OpenAI:
    # The SDK retries 429s and 5xx with exponential backoff before raising. With a backup provider waiting,
    # callers pass fewer retries so a busy provider hands over quickly.
    return OpenAI(base_url=provider.base_url, api_key=provider.api_key, max_retries=max_retries, timeout=60)

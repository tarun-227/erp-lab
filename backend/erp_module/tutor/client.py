"""Free LLM providers behind one OpenAI-compatible client.

Groq handles text (chat, quizzes, grading); Gemini handles requests that carry a
plot image. If only one key is set, everything goes to that provider. Keys are read
from the environment on every call, so adding a key to .env and restarting is enough.
GROQ_BASE_URL / GEMINI_BASE_URL can point either slot at another OpenAI-compatible server.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from openai import OpenAI

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
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


def route(has_image: bool) -> Provider | None:
    groq, gemini = _groq(), _gemini()
    if has_image:
        return gemini or groq
    return groq or gemini


def status() -> dict:
    text, vision = route(False), route(True)
    return {
        "enabled": text is not None,
        "text_provider": text.name if text else None,
        "vision_provider": vision.name if vision and vision.vision else None,
    }


def make_client(provider: Provider) -> OpenAI:
    # The SDK retries 429s and 5xx with exponential backoff before raising.
    return OpenAI(base_url=provider.base_url, api_key=provider.api_key, max_retries=3, timeout=60)

"""Tutor endpoints: streaming chat (SSE), quiz generation and short-answer grading."""

from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import OrderedDict, deque
from typing import Iterator, Literal

import openai
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from ..sessions import Session, store
from . import client as llm
from . import prompts
from .context import build_context
from .tools import TOOLS, proposal_in_text, to_event

router = APIRouter(prefix="/api/tutor")

MAX_HISTORY = 8
# Room for the reply. Gemini 2.5 "thinks" before answering and that counts against this limit, so a tight limit
# cut answers off mid-sentence; the prompt keeps the visible answer short.
MAX_TOKENS = 2048
RATE_LIMIT = 12  # requests per minute per session
_calls: dict[str, deque] = {}
_cache: OrderedDict[str, list[tuple[str, dict]]] = OrderedDict()
_lock = threading.Lock()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class PlotAttachment(BaseModel):
    name: str = Field(max_length=40)
    png_base64: str | None = Field(None, max_length=3_000_000)


class ChatRequest(BaseModel):
    session_id: str | None = None
    step: str = "load"
    messages: list[ChatMessage] = Field(min_length=1)
    socratic: bool = True
    plot: PlotAttachment | None = None


class QuizRequest(BaseModel):
    session_id: str | None = None
    step: str = "learn"
    n: int = Field(3, ge=1, le=5)


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    answer_index: int = Field(ge=0, le=3)
    explanation: str


class Quiz(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=1)


class GradeRequest(BaseModel):
    session_id: str | None = None
    step: str = "learn"
    question: str = Field(max_length=1000)
    answer: str = Field(max_length=2000)


class Grade(BaseModel):
    score: int = Field(ge=0, le=2)
    feedback: str


def _find_session(sid: str | None) -> Session | None:
    if not sid:
        return None
    try:
        return store.get(sid)
    except KeyError:
        return None


def _allow(key: str) -> bool:
    now = time.monotonic()
    with _lock:
        q = _calls.setdefault(key, deque())
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            return False
        q.append(now)
        return True


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


OFFLINE = "Tutor offline: add a free GEMINI_API_KEY or GROQ_API_KEY to .env to enable it."


def _busy_message() -> dict:
    return {"kind": "busy", "message": "The tutor is busy (free-tier limit). Try again in a minute."}


@router.get("/status")
def tutor_status() -> dict:
    return llm.status()


def _chat_messages(req: ChatRequest, session: Session | None, provider: llm.Provider) -> list[dict]:
    system = prompts.SYSTEM + "\n\n" + (prompts.SOCRATIC if req.socratic else prompts.DIRECT)
    history = [m.model_dump() for m in req.messages[-MAX_HISTORY:]]
    last = history[-1]
    text = f"[App state]\n{build_context(session, req.step)}\n\n"
    if req.plot:
        text += prompts.PLOT.format(plot=req.plot.name) + "\n\n"
    text += f"[Student]\n{last['content']}"
    if req.plot and req.plot.png_base64 and provider.vision:
        content: str | list = [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{req.plot.png_base64}"}},
        ]
    else:
        content = text
    return [{"role": "system", "content": system}, *history[:-1], {"role": "user", "content": content}]


def _stream_chat(req: ChatRequest, session: Session | None) -> Iterator[str]:
    candidates = llm.providers()
    if not candidates:
        yield _sse("error", {"kind": "offline", "message": OFFLINE})
        yield _sse("done", {})
        return
    if not _allow(req.session_id or "anonymous"):
        yield _sse("error", _busy_message())
        yield _sse("done", {})
        return

    current_params = session.meta.get("last", {}).get("params") if session else None
    for n, provider in enumerate(candidates):
        backup_left = n < len(candidates) - 1
        messages = _chat_messages(req, session, provider)
        key = hashlib.sha256(json.dumps([provider.name, messages], sort_keys=True).encode()).hexdigest()
        with _lock:
            cached = _cache.get(key)
        if cached:
            for event, data in cached:
                yield _sse(event, data)
            yield _sse("done", {"cached": True, "provider": provider.name})
            return

        emitted: list[tuple[str, dict]] = []
        calls: dict[int, dict] = {}
        try:
            stream = llm.make_client(provider, max_retries=1 if backup_left else 3).chat.completions.create(
                model=provider.model, messages=messages, tools=TOOLS, tool_choice="auto",
                stream=True, temperature=0.3, max_tokens=MAX_TOKENS,
            )
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta.content:
                    emitted.append(("delta", {"text": delta.content}))
                    yield _sse("delta", {"text": delta.content})
                for tc in delta.tool_calls or []:
                    slot = calls.setdefault(tc.index, {"name": "", "arguments": ""})
                    if tc.function and tc.function.name:
                        slot["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        slot["arguments"] += tc.function.arguments
        except openai.APIError as err:
            if backup_left and not emitted:
                continue  # nothing shown yet: hand the question to the backup provider
            if isinstance(err, openai.RateLimitError):
                yield _sse("error", _busy_message())
            else:
                yield _sse("error", {"kind": "error", "message": f"The tutor could not answer ({provider.name}): {err.message}"})
            yield _sse("done", {})
            return

        if not any(call["name"] == "propose_params" for call in calls.values()):
            reply = "".join(data["text"] for event, data in emitted if event == "delta")
            if written := proposal_in_text(reply):
                calls[len(calls)] = {"name": "propose_params", "arguments": written}
        events = [e for e in (to_event(c["name"], c["arguments"], current_params) for c in calls.values()) if e]
        if events and not any(event == "delta" for event, _ in emitted):
            # Some models reply with only a tool call; give it a line of text so it is not left bare.
            card = any(event == "action" for event, _ in events)
            lead = ("delta", {"text": "Here is an experiment to try. Apply it, then look at what changes:"
                              if card else "Look at the highlighted part of the plot."})
            emitted.append(lead)
            yield _sse(*lead)
        for event in events:
            emitted.append(event)
            yield _sse(*event)

        with _lock:
            _cache[key] = emitted
            while len(_cache) > 50:
                _cache.popitem(last=False)
        yield _sse("done", {"provider": provider.name})
        return


@router.post("/chat")
def chat(req: ChatRequest) -> StreamingResponse:
    session = _find_session(req.session_id)
    return StreamingResponse(
        _stream_chat(req, session),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _json_call(system: str, user: str, session_key: str | None) -> dict:
    candidates = llm.providers()
    if not candidates:
        raise HTTPException(503, OFFLINE)
    if not _allow(session_key or "anonymous"):
        raise HTTPException(429, _busy_message()["message"])
    for n, provider in enumerate(candidates):
        backup_left = n < len(candidates) - 1
        try:
            res = llm.make_client(provider, max_retries=1 if backup_left else 3).chat.completions.create(
                model=provider.model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"}, temperature=0.4, max_tokens=2 * MAX_TOKENS,
            )
            break
        except openai.APIError as err:
            if backup_left:
                continue
            if isinstance(err, openai.RateLimitError):
                raise HTTPException(429, _busy_message()["message"]) from None
            raise HTTPException(502, f"The tutor could not answer: {err.message}") from None
    try:
        return json.loads(res.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        return {}


@router.post("/quiz", response_model=Quiz)
def quiz(req: QuizRequest) -> Quiz:
    state = build_context(_find_session(req.session_id), req.step)
    user = f"[App state]\n{state}\n\n{prompts.QUIZ.format(n=req.n)}"
    for _ in range(2):  # one retry if the model returns malformed JSON
        try:
            return Quiz(**_json_call(prompts.SYSTEM, user, req.session_id))
        except (ValidationError, TypeError):
            continue
    raise HTTPException(502, "The tutor returned an unusable quiz. Please try again.")


@router.post("/grade", response_model=Grade)
def grade(req: GradeRequest) -> Grade:
    state = build_context(_find_session(req.session_id), req.step)
    user = f"[App state]\n{state}\n\n{prompts.GRADE.format(question=req.question, answer=req.answer)}"
    for _ in range(2):
        try:
            return Grade(**_json_call(prompts.SYSTEM, user, req.session_id))
        except (ValidationError, TypeError):
            continue
    raise HTTPException(502, "The tutor could not grade this answer. Please try again.")

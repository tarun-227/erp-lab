import json
from types import SimpleNamespace

import httpx
import openai
import pytest
from fastapi.testclient import TestClient

from erp_module.api import app
from erp_module.tutor import client as llm
from erp_module.tutor import routes
from erp_module.tutor.context import build_context
from erp_module.tutor.tools import to_event

client = TestClient(app)


@pytest.fixture(autouse=True)
def no_keys(monkeypatch):
    for var in ("GROQ_API_KEY", "GEMINI_API_KEY", "TUTOR_TEXT_MODEL", "TUTOR_VISION_MODEL", "GROQ_BASE_URL", "GEMINI_BASE_URL"):
        monkeypatch.delenv(var, raising=False)
    routes._cache.clear()
    routes._calls.clear()


def _events(body: str) -> list[tuple[str, dict]]:
    out = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def _chunk(text=None, tool=None):
    tool_calls = None
    if tool:
        tool_calls = [SimpleNamespace(index=0, function=SimpleNamespace(name=tool[0], arguments=tool[1]))]
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text, tool_calls=tool_calls))])


class FakeClient:
    def __init__(self, chunks=None, error=None, json_reply=None):
        self.calls = []

        def create(**kwargs):
            self.calls.append(kwargs)
            if error:
                raise error
            if kwargs.get("stream"):
                return iter(chunks or [])
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(json_reply)))])

        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))


def _session_with_results(params):
    sid = client.post("/api/data/sample").json()["session_id"]
    client.post(f"/api/sessions/{sid}/process", json=params)
    return sid


def test_routing_prefers_groq_for_text_and_gemini_for_images(monkeypatch):
    assert llm.route(False) is None and llm.status()["enabled"] is False
    monkeypatch.setenv("GROQ_API_KEY", "g")
    assert llm.route(True).name == "groq"  # only one key: everything goes there
    monkeypatch.setenv("GEMINI_API_KEY", "m")
    assert llm.route(False).name == "groq"
    assert llm.route(True).name == "gemini"
    assert llm.status() == {"enabled": True, "text_provider": "groq", "vision_provider": "gemini"}


def test_offline_without_keys():
    assert client.get("/api/tutor/status").json()["enabled"] is False
    res = client.post("/api/tutor/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    events = _events(res.text)
    assert events[0][0] == "error" and events[0][1]["kind"] == "offline"
    assert client.post("/api/tutor/quiz", json={}).status_code == 503


def test_context_has_numbers_but_no_raw_data(sample, params):
    from erp_module.sessions import store

    sid = _session_with_results(params)
    text = build_context(store.get(sid), "erp")
    assert "Current step: 4 ERP" in text
    assert "rejection threshold 150.0 µV" in text
    assert "Condition 'error'" in text and "Difference wave error − correct" in text
    assert len(text) < 3000  # summaries only, never the trial arrays


def test_tool_calls_are_validated(params):
    ok = to_event("propose_params", json.dumps({"changes": {"l_freq": 2.0}, "title": "HP 2 Hz", "watch": "P300"}), params)
    assert ok[0] == "action" and ok[1]["changes"] == {"l_freq": 2.0}
    assert to_event("propose_params", json.dumps({"changes": {"l_freq": 50.0}}), params) is None  # above low-pass
    assert to_event("propose_params", json.dumps({"changes": {"rm_rf": 1}}), params) is None
    assert to_event("propose_params", "{not json", params) is None
    assert to_event("go_to_step", json.dumps({"step": "erp"}), params)[0] == "navigate"
    assert to_event("go_to_step", json.dumps({"step": "nowhere"}), params) is None


def test_chat_streams_text_and_action_cards(monkeypatch, sample, params):
    monkeypatch.setenv("GROQ_API_KEY", "g")
    fake = FakeClient(chunks=[
        _chunk("Look at "), _chunk("Pz."),
        _chunk(tool=("propose_params", json.dumps({"changes": {"h_freq": 15.0}, "title": "Low-pass 15 Hz", "watch": "smoother"}))),
    ])
    monkeypatch.setattr(llm, "make_client", lambda provider: fake)
    sid = _session_with_results(params)
    res = client.post("/api/tutor/chat", json={"session_id": sid, "step": "erp", "messages": [{"role": "user", "content": "why?"}]})
    events = _events(res.text)
    assert [e for e, _ in events] == ["delta", "delta", "action", "done"]
    assert events[2][1]["changes"] == {"h_freq": 15.0}
    sent = fake.calls[0]["messages"][-1]["content"]
    assert "[App state]" in sent and "Condition 'error'" in sent


def test_image_goes_to_gemini_and_is_dropped_for_groq(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "g")
    seen = []
    monkeypatch.setattr(llm, "make_client", lambda p: seen.append(p.name) or FakeClient(chunks=[_chunk("ok")]))
    body = {"messages": [{"role": "user", "content": "explain"}], "plot": {"name": "erp", "png_base64": "aGk="}}
    client.post("/api/tutor/chat", json=body)
    monkeypatch.setenv("GEMINI_API_KEY", "m")
    routes._cache.clear()
    client.post("/api/tutor/chat", json=body)
    assert seen == ["groq", "gemini"]


def test_rate_limit_becomes_busy_event(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "g")
    err = openai.RateLimitError("slow down", response=httpx.Response(429, request=httpx.Request("POST", "http://x")), body=None)
    monkeypatch.setattr(llm, "make_client", lambda p: FakeClient(error=err))
    res = client.post("/api/tutor/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert _events(res.text)[0] == ("error", {"kind": "busy", "message": routes._busy_message()["message"]})


def test_quiz_output_is_validated(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "g")
    good = {"questions": [{"question": "Q?", "options": ["a", "b", "c", "d"], "answer_index": 2, "explanation": "because"}]}
    monkeypatch.setattr(llm, "make_client", lambda p: FakeClient(json_reply=good))
    assert client.post("/api/tutor/quiz", json={"n": 1}).json() == good
    bad = {"questions": [{"question": "Q?", "options": ["a", "b"], "answer_index": 7, "explanation": ""}]}
    monkeypatch.setattr(llm, "make_client", lambda p: FakeClient(json_reply=bad))
    assert client.post("/api/tutor/quiz", json={"n": 1}).status_code == 502

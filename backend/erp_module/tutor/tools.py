"""Tools the tutor can call. Each becomes a UI event; nothing changes until the student clicks."""

from __future__ import annotations

import json

from pydantic import ValidationError

from ..schemas import ProcessParams

STEPS = ["load", "events", "epoching", "erp", "learn", "export"]
PLOTS = ["raw", "erp_image", "erp", "topomap", "r2"]
# Names the model sees for the two filters. ProcessParams calls them l_freq / h_freq, which models confuse
# ("h" reads as high-pass), so the tool uses plain names and to_event maps them back.
ALIASES = {"high_pass_hz": "l_freq", "low_pass_hz": "h_freq"}
TUNABLE = {
    "high_pass_hz": {"type": "number", "description": "High-pass cut-off in Hz, removes slow drift (0 = off)"},
    "low_pass_hz": {"type": "number", "description": "Low-pass cut-off in Hz, removes fast noise (0 = off)"},
    "reference": {"type": "string", "description": '"average", "none" or a channel name'},
    "tmin": {"type": "number", "description": "Epoch start in seconds (negative)"},
    "tmax": {"type": "number", "description": "Epoch end in seconds"},
    "baseline": {"type": "boolean"},
    "baseline_start": {"type": "number"},
    "baseline_end": {"type": "number"},
    "reject_uv": {"type": "number", "description": "Peak-to-peak rejection threshold in µV (0 = off)"},
    "channel": {"type": "string"},
    "peak_start": {"type": "number"},
    "peak_end": {"type": "number"},
    "polarity": {"type": "string", "enum": ["positive", "negative"]},
}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "propose_params",
            "description": "Suggest a parameter change for the student to try. Shown as a card with Apply and Undo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "changes": {"type": "object", "properties": TUNABLE, "additionalProperties": False},
                    "title": {"type": "string", "description": "Short label, e.g. 'High-pass at 2 Hz'"},
                    "watch": {"type": "string", "description": "What to look for after applying it"},
                },
                "required": ["changes", "title", "watch"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "highlight",
            "description": "Highlight a time window and/or channel on one of the plots.",
            "parameters": {
                "type": "object",
                "properties": {
                    "plot": {"type": "string", "enum": PLOTS},
                    "start_s": {"type": "number"},
                    "end_s": {"type": "number"},
                    "channel": {"type": "string"},
                    "note": {"type": "string"},
                },
                "required": ["plot"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "go_to_step",
            "description": "Suggest moving to another step of the app.",
            "parameters": {
                "type": "object",
                "properties": {"step": {"type": "string", "enum": STEPS}, "reason": {"type": "string"}},
                "required": ["step"],
            },
        },
    },
]


def proposal_in_text(text: str) -> str | None:
    """A parameter suggestion the model wrote as JSON in its reply instead of calling propose_params.

    Some models do this despite the instructions; returning the arguments lets the app still show a card.
    """
    decoder = json.JSONDecoder()
    for start in (i for i, ch in enumerate(text) if ch == "{"):
        try:
            value, _ = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and isinstance(value.get("changes"), dict):
            return json.dumps(value)
    return None


def to_event(name: str, arguments: str, current_params: dict | None) -> tuple[str, dict] | None:
    """Validate one tool call and turn it into an (event, payload) pair; None if it is invalid."""
    try:
        args = json.loads(arguments or "{}")
    except json.JSONDecodeError:
        return None
    if not isinstance(args, dict):
        return None

    if name == "propose_params":
        changes = args.get("changes")
        if not isinstance(changes, dict) or not changes or current_params is None:
            return None
        changes = {ALIASES.get(k, k): v for k, v in changes.items()}
        if not set(changes) <= {ALIASES.get(k, k) for k in TUNABLE}:
            return None
        try:
            ProcessParams(**{**current_params, **changes})
        except (ValidationError, TypeError):
            return None
        return "action", {
            "changes": changes,
            "title": str(args.get("title", "Try this"))[:80],
            "watch": str(args.get("watch", ""))[:300],
        }
    if name == "highlight" and args.get("plot") in PLOTS:
        keep = {k: args[k] for k in ("plot", "start_s", "end_s", "channel", "note") if k in args}
        return "highlight", keep
    if name == "go_to_step" and args.get("step") in STEPS:
        return "navigate", {"step": args["step"], "reason": str(args.get("reason", ""))[:200]}
    return None

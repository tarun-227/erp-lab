"""Turn the student's current session into a short text summary for the tutor.

Only parameters and summary numbers go in; raw EEG and per-trial data never leave the server.
"""

from __future__ import annotations

from ..sessions import Session

STEP_NAMES = {
    "load": "1 Load data", "events": "2 Events", "epoching": "3 Epoching",
    "erp": "4 ERP", "learn": "5 Learn & Quiz", "export": "6 Export",
}


def _ms(s: float) -> str:
    return f"{s * 1000:.0f} ms"


def _peak(p: dict | None) -> str:
    return f"{p['amplitude_uv']:+.2f} µV at {_ms(p['latency_s'])}" if p else "none in window"


def build_context(session: Session | None, step: str) -> str:
    lines = [f"Current step: {STEP_NAMES.get(step, step)}"]
    if session is None:
        lines.append("No recording loaded yet.")
        return "\n".join(lines)

    raw = session.raw
    lines.append(
        f"Data: {session.source} recording, {len(raw.ch_names)} channels, {raw.info['sfreq']:.0f} Hz, "
        f"{raw.times[-1]:.0f} s, {len(session.events)} events."
    )
    last = session.meta.get("last")
    if not last:
        lines.append("Epochs have not been computed yet.")
        return "\n".join(lines)

    p, r = last["params"], last["result"]
    filt = (
        f"{p['l_freq'] or 0:g}–{p['h_freq']:g} Hz" if p.get("h_freq")
        else (f"high-pass {p['l_freq']:g} Hz" if p.get("l_freq") else "no filter")
    )
    base = f"{_ms(p['baseline_start'])} to {_ms(p['baseline_end'])}" if p["baseline"] else "off"
    lines.append(
        f"Parameters: filter {filt}; reference {p['reference']}; epoch {_ms(p['tmin'])} to {_ms(p['tmax'])}; "
        f"baseline {base}; rejection threshold {str(p['reject_uv']) + ' µV' if p.get('reject_uv') else 'off'}; "
        f"channel {r['channel']}; peak window {_ms(p['peak_start'])}–{_ms(p['peak_end'])} ({p['polarity']})."
    )
    d = r["drop"]
    worst = ", ".join(f"{ch} {n}" for ch, n in list(d["by_channel"].items())[:4]) or "none"
    lines.append(
        f"Epochs: {d['total_events']} events, {d['edge']} too close to the recording edge, "
        f"{d['rejected']} rejected (blamed channel: {worst}), {d['kept']} kept."
    )
    for c in r["conditions"]:
        if c["n_kept"]:
            lines.append(
                f"Condition '{c['name']}' (code {c['code']}): {c['n_kept']} of {c['n_total']} epochs kept; "
                f"peak {_peak(c.get('peak'))}; mean amplitude in window {c['mean_amplitude_uv']:+.2f} µV."
            )
        else:
            lines.append(f"Condition '{c['name']}' (code {c['code']}): no epochs kept.")
    if r.get("difference"):
        diff = r["difference"]
        lines.append(f"Difference wave {diff['label']}: peak {_peak(diff['peak'])}.")
    return "\n".join(lines)

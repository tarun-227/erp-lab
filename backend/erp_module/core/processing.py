"""Filtering, re-referencing, epoching and artefact rejection.

Every step uses plain MNE calls in the same order as the exported script
(core/codegen.py), so the script reproduces exactly what the app shows.
"""

from __future__ import annotations

from dataclasses import dataclass

import mne
import numpy as np


def check_settings(raw: mne.io.BaseRaw, h_freq: float | None, reference: str) -> None:
    """Raise a ValueError a student can act on when the settings do not fit this recording."""
    nyquist = raw.info["sfreq"] / 2
    if h_freq and h_freq >= nyquist:
        raise ValueError(
            f"The low-pass cut-off ({h_freq:g} Hz) must be below half the sampling rate ({nyquist:g} Hz). "
            "Choose a lower low-pass or switch it off."
        )
    eeg = [raw.ch_names[i] for i in mne.pick_types(raw.info, eeg=True)]
    if reference not in ("average", "none") and reference not in eeg:
        raise ValueError(f'The reference channel "{reference}" is not in this recording.')


def preprocess(raw: mne.io.BaseRaw, l_freq: float | None, h_freq: float | None, reference: str) -> mne.io.BaseRaw:
    """Band-pass filter the EEG channels, then re-reference ("average", "none" or a channel name)."""
    check_settings(raw, h_freq, reference)
    out = raw.copy().load_data()
    if l_freq or h_freq:
        out.filter(l_freq or None, h_freq or None, picks="eeg", verbose=False)
    if reference == "average":
        out.set_eeg_reference("average", projection=False, verbose=False)
    elif reference != "none":
        out.set_eeg_reference([reference], verbose=False)
    return out


@dataclass
class EpochResult:
    epochs: mne.Epochs
    """All epochs that fit inside the recording, including ones the threshold would reject."""
    kept: np.ndarray
    ptp_uv: np.ndarray
    """Peak-to-peak amplitude per epoch and channel, in µV."""
    n_events: int
    n_edge: int
    """Events whose window runs off the recording."""
    n_bad_span: int = 0
    """Events whose window overlaps an annotation marked BAD (or EDGE); MNE skips these."""
    n_duplicate: int = 0
    """Second events at the same sample as another one."""

    @property
    def worst_channel(self) -> list[str]:
        names = self.epochs.ch_names
        return [names[i] for i in self.ptp_uv.argmax(axis=1)]

    def drop_summary(self) -> dict:
        """Kept/rejected counts; each rejected epoch is blamed on the channel with the largest swing."""
        by_channel: dict[str, int] = {}
        for ch, kept in zip(self.worst_channel, self.kept):
            if not kept:
                by_channel[ch] = by_channel.get(ch, 0) + 1
        return {
            "total_events": self.n_events,
            "edge": self.n_edge,
            "bad_span": self.n_bad_span,
            "duplicate": self.n_duplicate,
            "rejected": int((~self.kept).sum()),
            "kept": int(self.kept.sum()),
            "by_channel": dict(sorted(by_channel.items(), key=lambda kv: -kv[1])),
        }


def make_epochs(
    raw: mne.io.BaseRaw,
    events: np.ndarray,
    event_id: dict[str, int],
    tmin: float,
    tmax: float,
    baseline: tuple[float, float] | None,
    reject_uv: float | None,
) -> EpochResult:
    """Cut epochs around the events and flag the ones whose peak-to-peak swing exceeds reject_uv.

    Flagged epochs stay in the result so they can be shown greyed out; this matches
    mne.Epochs(reject=dict(eeg=reject_uv * 1e-6)), which drops an epoch when any EEG
    channel's peak-to-peak amplitude is above the threshold.
    """
    selected = events[np.isin(events[:, 2], list(event_id.values()))]
    epochs = mne.Epochs(
        raw, selected, event_id, tmin=tmin, tmax=tmax, baseline=baseline, picks="eeg",
        reject=None, preload=True, event_repeated="drop", verbose=False,
    )
    data = epochs.get_data(copy=False)
    ptp_uv = (data.max(axis=-1) - data.min(axis=-1)) * 1e6
    kept = ~(ptp_uv > reject_uv).any(axis=1) if reject_uv else np.ones(len(epochs), bool)
    logs = [log for log in epochs.drop_log if log]
    n_edge = sum(any(r in ("NO_DATA", "TOO_SHORT") for r in log) for log in logs)
    n_bad = sum(any(r.upper().startswith(("BAD", "EDGE")) for r in log) for log in logs)
    return EpochResult(
        epochs, kept, ptp_uv, n_events=len(selected), n_edge=n_edge, n_bad_span=n_bad,
        n_duplicate=len(selected) - len(epochs) - n_edge - n_bad,
    )

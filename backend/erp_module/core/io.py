"""Loading recordings and finding their events."""

from __future__ import annotations

from pathlib import Path

import mne
import numpy as np

# Large uploads are trimmed so the app stays responsive in a classroom.
MAX_SFREQ = 300.0
TARGET_SFREQ = 250.0
MAX_DURATION_S = 20 * 60

READABLE = (".fif", ".fif.gz", ".edf", ".bdf", ".set", ".vhdr", ".gdf", ".cnt")


def find_events(raw: mne.io.BaseRaw) -> tuple[np.ndarray, dict[str, str]]:
    """Events from the stim channel if there is one, otherwise from annotations.

    Returns the events and a suggested name for each code: annotation descriptions
    when they exist, otherwise "Code N".
    """
    stim = mne.pick_types(raw.info, stim=True, eeg=False)
    if len(stim):
        events = mne.find_events(raw, stim_channel=raw.ch_names[stim[0]], shortest_event=1, verbose=False)
        names = {str(c): f"Code {c}" for c in np.unique(events[:, 2])}
        return events, names
    if not len(raw.annotations):
        return np.empty((0, 3), int), {}
    events, mapping = mne.events_from_annotations(raw, verbose=False)
    return events, {str(code): desc for desc, code in mapping.items()}


def summarize(raw: mne.io.BaseRaw, events: np.ndarray) -> dict:
    eeg = mne.pick_types(raw.info, eeg=True)
    ids, counts = np.unique(events[:, 2], return_counts=True) if len(events) else ([], [])
    return {
        "n_channels": int(len(eeg)),
        "ch_names": [raw.ch_names[i] for i in eeg],
        "sfreq": float(raw.info["sfreq"]),
        "duration_s": float(raw.times[-1]),
        "n_events": int(len(events)),
        "event_counts": {str(int(i)): int(c) for i, c in zip(ids, counts)},
    }


def montage_name() -> str:
    """The 10-20 template montage; MNE 1.13 renamed standard_1020 to colin27_1020."""
    return "colin27_1020" if "colin27_1020" in mne.channels.get_builtin_montages() else "standard_1020"


def _ensure_positions(raw: mne.io.BaseRaw) -> None:
    eeg = mne.pick_types(raw.info, eeg=True)
    has_pos = any(np.isfinite(raw.info["chs"][i]["loc"][:3]).all() and np.abs(raw.info["chs"][i]["loc"][:3]).sum() > 0 for i in eeg)
    if not has_pos:
        montage = mne.channels.make_standard_montage(montage_name())
        _tidy_names(raw, montage.ch_names)
        raw.set_montage(montage, match_case=False, on_missing="ignore", verbose=False)


def _tidy_names(raw: mne.io.BaseRaw, known: list[str]) -> None:
    """Rename channels like PhysioNet's "Fc5." or "CZ" to their 10-20 spelling ("FC5", "Cz")."""
    lookup = {n.lower(): n for n in known}
    taken = set(raw.ch_names)
    mapping = {}
    for i in mne.pick_types(raw.info, eeg=True):
        name = raw.ch_names[i]
        clean = lookup.get(name.strip(" .").lower())
        if clean and clean != name and clean not in taken:
            mapping[name] = clean
            taken.add(clean)
    if mapping:
        raw.rename_channels(mapping)


def prepare(raw: mne.io.BaseRaw) -> tuple[mne.io.BaseRaw, np.ndarray, dict[str, str]]:
    """Keep EEG + stim channels, trim long recordings, downsample fast ones, and find events."""
    raw = raw.copy()
    picks = mne.pick_types(raw.info, eeg=True, stim=True)
    if not len(mne.pick_types(raw.info, eeg=True)):
        raise ValueError("The file has no EEG channels.")
    raw.pick(picks)
    if raw.times[-1] > MAX_DURATION_S:
        raw.crop(0, MAX_DURATION_S)
    raw.load_data(verbose=False)
    _ensure_positions(raw)
    events, names = find_events(raw)
    if not len(events):
        raise ValueError("No events were found: the file needs a stim channel or annotations.")
    if raw.info["sfreq"] > MAX_SFREQ:
        raw, events = raw.resample(TARGET_SFREQ, events=events, verbose=False)
    return raw, events, names


def read_upload(paths: list[Path]) -> mne.io.BaseRaw:
    """Read the main recording among the uploaded files (companion files such as .fdt or .eeg sit beside it)."""
    main = [p for p in paths if p.name.lower().endswith(READABLE)]
    if not main:
        raise ValueError(f"Unsupported file type. Upload one of: {', '.join(READABLE)}")
    return mne.io.read_raw(main[0], preload=True, verbose=False)

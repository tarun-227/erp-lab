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
    try:
        events, mapping = mne.events_from_annotations(raw, verbose=False)
    except ValueError:  # every annotation marks a BAD or EDGE segment, which MNE skips
        return np.empty((0, 3), int), {}
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


def repair_nonfinite(raw: mne.io.BaseRaw) -> str | None:
    """Fill NaN/Inf samples by linear interpolation and mark those stretches BAD.

    A single NaN would otherwise spread through the filter to the whole channel and, through the
    average reference, to every channel. Epochs that touch a marked stretch are skipped.
    """
    eeg = mne.pick_types(raw.info, eeg=True)
    data = raw._data
    bad = ~np.isfinite(data[eeg])
    if not bad.any():
        return None
    idx = np.arange(raw.n_times)
    for row, mask in zip(eeg, bad):
        if mask.all():
            data[row] = 0.0
        elif mask.any():
            data[row, mask] = np.interp(idx[mask], idx[~mask], data[row, ~mask])
    gap = bad.any(axis=0).astype(np.int8)
    edges = np.flatnonzero(np.diff(np.r_[0, gap, 0]))
    starts, stops = edges[::2], edges[1::2]
    sfreq = raw.info["sfreq"]
    # Appending in place keeps every existing annotation where it is (set_annotations can re-anchor them).
    raw.annotations.append(raw.first_time + starts / sfreq, (stops - starts) / sfreq, "BAD_missing_data")
    chans = [raw.ch_names[eeg[i]] for i in np.flatnonzero(bad.any(axis=1))]
    shown = ", ".join(chans[:4]) + (f" and {len(chans) - 4} more" if len(chans) > 4 else "")
    return (
        f"{int(bad.sum())} missing samples (NaN/Inf) on {shown} were filled in and marked bad; "
        "epochs that touch them are left out."
    )


def prepare(raw: mne.io.BaseRaw, notes: list[str] | None = None) -> tuple[mne.io.BaseRaw, np.ndarray, dict[str, str]]:
    """Keep EEG + stim channels, trim long recordings, downsample fast ones, and find events.

    Anything changed on the way is described in ``notes`` (when given) so the student is told.
    """
    notes = notes if notes is not None else []
    raw = raw.copy()
    picks = mne.pick_types(raw.info, eeg=True, stim=True)
    if not len(mne.pick_types(raw.info, eeg=True)):
        raise ValueError("The file has no EEG channels.")
    raw.pick(picks)
    if raw.times[-1] > MAX_DURATION_S:
        notes.append(f"Only the first {MAX_DURATION_S // 60} minutes of the {raw.times[-1] / 60:.0f}-minute recording are used.")
        raw.crop(0, MAX_DURATION_S)
    raw.load_data(verbose=False)
    if note := repair_nonfinite(raw):
        notes.append(note)
    before = list(raw.ch_names)
    _ensure_positions(raw)
    if renamed := sum(a != b for a, b in zip(before, raw.ch_names)):
        notes.append(f"{renamed} channel names were changed to their standard 10-20 spelling.")
    events, names = find_events(raw)
    if not len(events):
        raise ValueError("No events were found: the file needs a stim channel or annotations.")
    if raw.info["sfreq"] > MAX_SFREQ:
        notes.append(f"Resampled from {raw.info['sfreq']:g} Hz to {TARGET_SFREQ:g} Hz.")
        raw, events = raw.resample(TARGET_SFREQ, events=events, verbose=False)
    return raw, events, names


COMPANIONS = {".vhdr": (".vmrk", ".eeg"), ".set": (".fdt",)}


def read_error_message(err: Exception, paths: list[Path], tmp: Path) -> str:
    """Explain a failed read in words a student can act on, without leaking server paths."""
    main = next((p for p in paths if p.name.lower().endswith(READABLE)), paths[0])
    names = {p.suffix.lower() for p in paths}
    missing = [ext for ext in COMPANIONS.get(main.suffix.lower(), ()) if ext not in names]
    detail = str(err).replace(str(tmp), "").replace(str(tmp).replace("\\", "/"), "").strip(" '\"\\/")
    if missing and isinstance(err, (FileNotFoundError, OSError)):
        return f"{main.name} needs its companion file(s) {', '.join(missing)}. Select them together and upload again."
    return (
        f"Could not read {main.name}: the file looks damaged, incomplete or not an EEG recording in this format. "
        f"(Reader said: {detail[:200]})"
    )


def read_upload(paths: list[Path]) -> mne.io.BaseRaw:
    """Read the main recording among the uploaded files (companion files such as .fdt or .eeg sit beside it)."""
    main = [p for p in paths if p.name.lower().endswith(READABLE)]
    if not main:
        raise ValueError(f"Unsupported file type. Upload one of: {', '.join(READABLE)}")
    return mne.io.read_raw(main[0], preload=True, verbose=False)

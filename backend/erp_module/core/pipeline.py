"""Run the whole epoch → ERP pipeline for one set of parameters and package it for the frontend."""

from __future__ import annotations

import mne
import numpy as np

from . import erp
from .processing import make_epochs


def _r(a: np.ndarray, decimals: int = 2) -> list:
    return np.round(a, decimals).tolist()


def process(pre: mne.io.BaseRaw, events: np.ndarray, p: dict) -> dict:
    """`pre` is the filtered, re-referenced recording; `p` is a ProcessParams dump."""
    event_id = {c["name"]: c["code"] for c in p["conditions"]}
    code_to_name = {c["code"]: c["name"] for c in p["conditions"]}
    baseline = (p["baseline_start"], p["baseline_end"]) if p["baseline"] else None
    result = make_epochs(pre, events, event_id, p["tmin"], p["tmax"], baseline, p.get("reject_uv") or None)

    epochs = result.epochs
    times = epochs.times
    data_uv = epochs.get_data(copy=False) * 1e6
    ch_names = epochs.ch_names
    channel = p["channel"] if p["channel"] in ch_names else ("Pz" if "Pz" in ch_names else ch_names[0])
    trials = data_uv[:, ch_names.index(channel), :]
    labels = np.array([code_to_name[c] for c in epochs.events[:, 2]])
    window = (p["peak_start"], p["peak_end"])

    conditions = []
    means_all = {}
    for name in event_id:
        mask = (labels == name) & result.kept
        entry = {"name": name, "code": event_id[name], "n_total": int((labels == name).sum()), "n_kept": int(mask.sum())}
        if mask.any():
            mean, ci = erp.average_with_ci(trials[mask])
            means_all[name] = data_uv[mask].mean(axis=0)
            entry.update(
                mean=_r(mean), ci=_r(ci),
                peak=erp.find_peak(times, mean, window, p["polarity"]),
                mean_amplitude_uv=erp.mean_amplitude(times, mean, window),
                topo_mean=_r(means_all[name]),
            )
        conditions.append(entry)

    difference = None
    names = [c["name"] for c in conditions if c["name"] in means_all]
    if len(event_id) == 2 and len(names) == 2:
        a, b = names
        wave = means_all[b][ch_names.index(channel)] - means_all[a][ch_names.index(channel)]
        difference = {
            "label": f"{b} − {a}",
            "wave": _r(wave),
            "peak": erp.find_peak(times, wave, window, p["polarity"]),
            "mean_amplitude_uv": erp.mean_amplitude(times, wave, window),
        }

    first = pre.first_samp
    sfreq = pre.info["sfreq"]
    return {
        "times": _r(times, 4),
        "channel": channel,
        "ch_names": ch_names,
        "trials": _r(trials),
        "labels": labels.tolist(),
        "kept": result.kept.tolist(),
        "event_times_s": _r((epochs.events[:, 0] - first) / sfreq, 4),
        "worst_channel": result.worst_channel,
        "max_ptp_uv": _r(result.ptp_uv.max(axis=1), 1),
        "drop": result.drop_summary(),
        "conditions": conditions,
        "difference": difference,
    }


def raw_window(pre: mne.io.BaseRaw, start_s: float, duration_s: float, max_points: int = 2000) -> dict:
    """A display-ready slice of the processed recording: every EEG channel, decimated, in µV."""
    sfreq = pre.info["sfreq"]
    start = int(min(max(start_s, 0.0), pre.times[-1]) * sfreq)
    stop = min(start + int(duration_s * sfreq), pre.n_times)
    step = max(1, int(np.ceil((stop - start) / max_points)))
    picks = mne.pick_types(pre.info, eeg=True)
    data = pre.get_data(picks=picks, start=start, stop=stop)[:, ::step] * 1e6
    return {
        "times": _r(np.arange(start, stop, step) / sfreq, 4),
        "ch_names": [pre.ch_names[i] for i in picks],
        "data": _r(data, 1),
        "duration_total_s": float(pre.times[-1]),
    }

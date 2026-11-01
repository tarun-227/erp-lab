"""Build data/sample_erp_raw.fif, the bundled "real sample", from ERP CORE.

Source: ERP CORE flanker task, participant 1 (Kappenman et al., 2021, NeuroImage 225:117465),
as distributed by MNE-Python (mne.datasets.erp_core, ~90 MB download, once).

What this script does:
- keeps the EEG channels and resamples to 250 Hz (the app's working rate);
- relabels the events into four teaching conditions:
    stimulus/compatible, stimulus/incompatible   (flanker arrays)
    response/correct, response/error             (button presses, scored against the preceding target)
- saves single-precision FIF so the file stays small enough for the repository.

Run from the project root:  python scripts/make_sample_data.py
"""

from __future__ import annotations

from pathlib import Path

import mne
import numpy as np

OUT = Path(__file__).resolve().parents[1] / "data" / "sample_erp_raw.fif"
SFREQ = 250.0


def relabel(raw: mne.io.BaseRaw) -> mne.Annotations:
    onsets, durations, labels = [], [], []
    target_side = None
    for ann in raw.annotations:
        desc = ann["description"]
        parts = desc.split("/")
        if parts[0] == "stimulus" and len(parts) >= 3:
            target_side = parts[2].replace("target_", "")
            onsets.append(ann["onset"])
            durations.append(0.0)
            labels.append(f"stimulus/{parts[1]}")
        elif parts[0] == "response" and len(parts) >= 2 and target_side is not None:
            onsets.append(ann["onset"])
            durations.append(0.0)
            labels.append("response/correct" if parts[1] == target_side else "response/error")
            target_side = None  # score only the first response after each stimulus
    return mne.Annotations(onsets, durations, labels, orig_time=raw.annotations.orig_time)


def main() -> None:
    path = mne.datasets.erp_core.data_path() / "ERP-CORE_Subject-001_Task-Flankers_eeg.fif"
    raw = mne.io.read_raw_fif(path, preload=True)
    raw.pick("eeg")
    raw.set_annotations(relabel(raw))
    raw.resample(SFREQ)
    OUT.parent.mkdir(exist_ok=True)
    raw.save(OUT, fmt="single", overwrite=True)

    labels, counts = np.unique(raw.annotations.description, return_counts=True)
    print(f"Saved {OUT} ({OUT.stat().st_size / 1e6:.1f} MB): {len(raw.ch_names)} channels, {raw.times[-1]:.0f} s")
    for label, count in zip(labels, counts):
        print(f"  {label}: {count}")


if __name__ == "__main__":
    main()

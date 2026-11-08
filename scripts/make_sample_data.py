"""Build the three bundled sample recordings in data/. They are three different kinds of experiment.

flanker  data/sample_erp_raw.fif
    ERP CORE flanker task, participant 1 (Kappenman et al., 2021, NeuroImage 225:117465), as distributed by
    MNE-Python (mne.datasets.erp_core, ~90 MB download, once). Visual, with stimulus and response events
    scored against the preceding target. Shows the error-related negativity (ERN) and the P3.
oddball  data/sample_oddball_raw.fif
    Auditory oddball, OpenNeuro ds003061, sub-001 run 1 (Delorme, 2020, CC0; doi:10.18112/openneuro.ds003061).
    70% 500 Hz tones, 15% 1000 Hz target tones, 15% white-noise distractors; keypress for the target. A 32-channel
    subset of the 64 BioSemi channels keeps the file small. Shows the auditory N1 and the P300.
ssvep    data/sample_ssvep_raw.fif
    SSVEP example data, sub-02 (Welke & Tavano, OSF 10.17605/OSF.IO/7NE6Y, CC-BY 4.0; mne.datasets.ssvep). Ten
    20 s trials each of 12 Hz and 15 Hz flicker. Epochs in this app stop at 2 s, so each trial is split into 18
    one-second segments, which hold a whole number of cycles at both rates and so stay in phase when averaged.

Each is resampled to 250 Hz (the app's working rate) and saved in single precision to stay small.

Run from the project root:  python scripts/make_sample_data.py [flanker] [oddball] [ssvep]   (default: all three)
Downloads are cached in ~/mne_data.
"""

from __future__ import annotations

import sys
from pathlib import Path

import mne
import numpy as np
import pooch

DATA = Path(__file__).resolve().parents[1] / "data"
CACHE = Path(mne.get_config("MNE_DATA", str(Path.home() / "mne_data"))) / "ERP-Lab-examples" / "downloads"
SFREQ = 250.0

ODDBALL_URL = "https://s3.amazonaws.com/openneuro.org/ds003061/sub-001/eeg/sub-001_task-P300_run-1_eeg.set"
ODDBALL_MD5 = "md5:2975e3a5779465394e03961323e25f4a"
ODDBALL_EVENTS = {
    "standard": "tone/standard",
    "oddball": "tone/oddball",
    "oddball_with_reponse": "tone/oddball",  # sic: the dataset's spelling
    "noise": "sound/noise",
    "noise_with_reponse": "sound/noise",
    "response": "response/keypress",
}
ODDBALL_CHANNELS = [
    "Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8", "FC5", "FC1", "FCz", "FC2", "FC6", "T7", "C3", "Cz", "C4",
    "T8", "CP5", "CP1", "CPz", "CP2", "CP6", "P7", "P3", "Pz", "P4", "P8", "PO3", "PO4", "O1", "Oz", "O2",
]

SSVEP_URL = "https://osf.io/download/z8h6k?version=5"
SSVEP_MD5 = "md5:af866bbc0f921114ac9d683494fe87d6"
# Measured from whole trials: the coherent average at Oz peaks at this rate for each marker.
SSVEP_EVENTS = {"Stimulus/S255": "flicker/12 Hz", "Stimulus/S155": "flicker/15 Hz"}
SSVEP_SEGMENTS = range(1, 19)  # seconds into each 20 s trial; skips the onset response at second 0


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


def flanker() -> mne.io.BaseRaw:
    path = mne.datasets.erp_core.data_path() / "ERP-CORE_Subject-001_Task-Flankers_eeg.fif"
    raw = mne.io.read_raw_fif(path, preload=True)
    raw.pick("eeg")
    raw.set_annotations(relabel(raw))
    return raw


def oddball() -> mne.io.BaseRaw:
    path = pooch.retrieve(ODDBALL_URL, ODDBALL_MD5, fname="ds003061_sub-001_run-1_eeg.set", path=CACHE, progressbar=True)
    raw = mne.io.read_raw_eeglab(path, preload=True)
    raw.pick(ODDBALL_CHANNELS)
    raw.set_montage("biosemi64")
    a = raw.annotations
    keep = [i for i, d in enumerate(a.description) if d in ODDBALL_EVENTS]
    raw.set_annotations(mne.Annotations(a.onset[keep], 0.0, [ODDBALL_EVENTS[a.description[i]] for i in keep], orig_time=a.orig_time))
    return raw


def ssvep() -> mne.io.BaseRaw:
    files = pooch.retrieve(SSVEP_URL, SSVEP_MD5, fname="ssvep_example_data.zip", path=CACHE, processor=pooch.Unzip(extract_dir="ssvep"), progressbar=True)
    vhdr = next(f for f in files if f.endswith("sub-02_ses-01_task-ssvep_eeg.vhdr"))
    raw = mne.io.read_raw_brainvision(vhdr, preload=True)
    raw.pick("eeg")
    a = raw.annotations
    onsets, labels = [], []
    for onset, desc in zip(a.onset, a.description):
        if desc in SSVEP_EVENTS:
            onsets += [onset + k for k in SSVEP_SEGMENTS]
            labels += [SSVEP_EVENTS[desc]] * len(SSVEP_SEGMENTS)
    raw.set_annotations(mne.Annotations(onsets, 0.0, labels, orig_time=a.orig_time))
    return raw


SAMPLES = {
    "flanker": (flanker, "sample_erp_raw.fif"),
    "oddball": (oddball, "sample_oddball_raw.fif"),
    "ssvep": (ssvep, "sample_ssvep_raw.fif"),
}


def main() -> None:
    DATA.mkdir(exist_ok=True)
    for name in sys.argv[1:] or SAMPLES:
        build, filename = SAMPLES[name]
        raw = build()
        raw.resample(SFREQ)
        out = DATA / filename
        raw.save(out, fmt="single", overwrite=True)
        labels, counts = np.unique(raw.annotations.description, return_counts=True)
        print(f"Saved {out} ({out.stat().st_size / 1e6:.1f} MB): {len(raw.ch_names)} channels, {raw.times[-1]:.0f} s")
        for label, count in zip(labels, counts):
            print(f"  {label}: {count}")


if __name__ == "__main__":
    main()

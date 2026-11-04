"""Build ready-to-upload example recordings in data/examples/ from public datasets the course recommends.

The bundled sample (ERP CORE flanker) loads with one click; these files exercise the *upload* path with other
formats, montages, sampling rates and event sources.

  p300_cattan2019_s01_raw.fif   P300 "Brain Invaders" on a PC screen, subject 1 (Cattan et al., 2019;
                                Zenodo 10.5281/zenodo.2605205, CC-BY-4.0). The same file MOABB's
                                Cattan2019_VR dataset loads; read here with SciPy so MOABB is not needed.
                                16 EEG channels, 512 Hz (the app resamples to 250 Hz), events
                                "Target" / "NonTarget" as annotations. Best for ERPs: a P300 at Pz/Cz.
  physionet_mi_s001r03.edf      PhysioNet EEG Motor Movement/Imagery, subject 1, run 3 (Schalk et al., 2004;
                                Goldberger et al., 2000; ODC-By), via mne.datasets.eegbci, copied unchanged.
                                64 channels, 160 Hz, EDF annotations T0 (rest), T1 (left fist), T2 (right fist).
                                Tests a native EDF with PhysioNet's "Fcz." channel names.

Run from the project root:  python scripts/make_upload_examples.py   (needs pooch, which MNE's datasets use)
Downloads (~19 MB) go to ~/mne_data the first time.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import mne
import numpy as np
import pooch
from scipy.io import loadmat

OUT = Path(__file__).resolve().parents[1] / "data" / "examples"
CACHE = Path(mne.get_config("MNE_DATA", str(Path.home() / "mne_data"))) / "ERP-Lab-examples"

CATTAN_URL = "https://zenodo.org/records/2605205/files/subject_01_PC.mat?download=1"
CATTAN_MD5 = "md5:8e9d746543d73527fb4e80748c28e88d"
CATTAN_SFREQ = 512.0
# Columns of the "data" matrix, from the record's Header.csv.
CATTAN_COLUMNS = ["Time", "Fp1", "Fp2", "FC5", "Fz", "FC6", "T7", "Cz", "T8", "P7", "P3", "Pz", "P4", "P8", "O1", "Oz", "O2",
                  "Event", "IsTarget", "IsNonTarget", "IsStartOfNewBlock", "EndOfRepetitionNumber"]


def p300() -> Path:
    path = pooch.retrieve(CATTAN_URL, CATTAN_MD5, fname="subject_01_PC.mat", path=CACHE, progressbar=True)
    data = loadmat(path)["data"]
    col = {name: i for i, name in enumerate(CATTAN_COLUMNS)}
    eeg_names = CATTAN_COLUMNS[1:17]
    signals = data[:, 1:17].T * 1e-6  # stored in µV
    raw = mne.io.RawArray(signals, mne.create_info(eeg_names, CATTAN_SFREQ, "eeg"), verbose=False)

    onsets, labels = [], []
    for name in ("Target", "NonTarget"):
        flag = data[:, col[f"Is{name}"]] > 0
        starts = np.flatnonzero(flag & ~np.r_[False, flag[:-1]])
        onsets += list(starts / CATTAN_SFREQ)
        labels += [name] * len(starts)
    order = np.argsort(onsets)
    raw.set_annotations(mne.Annotations(np.array(onsets)[order], 0.0, np.array(labels)[order]))

    out = OUT / "p300_cattan2019_s01_raw.fif"
    raw.save(out, fmt="single", overwrite=True, verbose=False)
    return out


def physionet_mi() -> Path:
    from mne.datasets import eegbci

    (src,) = eegbci.load_data(subjects=1, runs=[3], update_path=False, verbose=False)
    out = OUT / "physionet_mi_s001r03.edf"
    shutil.copyfile(src, out)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for build in (p300, physionet_mi):
        out = build()
        print(f"{out.relative_to(OUT.parents[1])}: {out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

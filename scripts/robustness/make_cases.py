"""Generate edge-case, noisy and corrupted uploads from the real ERP CORE sample.

Usage (from the project root):  python scripts/robustness/make_cases.py . <output dir>
Needs edfio, eeglabio and pybv for the EDF/BDF, EEGLAB and BrainVision exports (pip install edfio eeglabio pybv).
Each case is a list of files uploaded together; cases.json maps case name -> [files, expectation].
expectation: "ok" (should load), "reject" (should give a clean 4xx), "either" (either is acceptable).
"""

import json
import os
import sys
from pathlib import Path

import mne
import numpy as np

root, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(0)
base = mne.io.read_raw_fif(root / "data" / "sample_erp_raw.fif", preload=True, verbose=False).crop(0, 240)
cases: dict[str, tuple[list[str], str]] = {}


def save_fif(name, raw, expect="ok"):
    raw.save(out / f"{name}_raw.fif", overwrite=True, verbose=False)
    cases[name] = ([f"{name}_raw.fif"], expect)


def modified(fn):
    raw = base.copy()
    fn(raw)
    return raw


def add(raw, uv):
    raw._data[mne.pick_types(raw.info, eeg=True)] += uv * 1e-6


# ---------- formats ----------
mne.export.export_raw(out / "fmt_edf.edf", base, fmt="edf", overwrite=True, verbose=False)
cases["fmt_edf"] = (["fmt_edf.edf"], "ok")
try:
    mne.export.export_raw(out / "fmt_bdf.bdf", base, fmt="bdf", overwrite=True, verbose=False)
    cases["fmt_bdf"] = (["fmt_bdf.bdf"], "ok")
except Exception as err:
    print("bdf export unavailable:", err)
mne.export.export_raw(out / "fmt_eeglab.set", base, fmt="eeglab", overwrite=True, verbose=False)
fdt = [p.name for p in out.glob("fmt_eeglab*.fdt")]
cases["fmt_eeglab"] = (["fmt_eeglab.set", *fdt], "ok")
mne.export.export_raw(out / "fmt_bv.vhdr", base, fmt="brainvision", overwrite=True, verbose=False)
cases["fmt_brainvision"] = (["fmt_bv.vhdr", "fmt_bv.eeg", "fmt_bv.vmrk"], "ok")
base.save(out / "fmt_gz_raw.fif.gz", overwrite=True, verbose=False)
cases["fmt_fif_gz"] = (["fmt_gz_raw.fif.gz"], "ok")
base.save(out / "upper_tmp_raw.fif", overwrite=True, verbose=False)
os.replace(out / "upper_tmp_raw.fif", out / "UPPER_RAW.FIF")
cases["fmt_uppercase_ext"] = (["UPPER_RAW.FIF"], "ok")
base.save(out / "my récording ünïcode raw.fif", overwrite=True, verbose=False)
cases["fmt_unicode_name"] = (["my récording ünïcode raw.fif"], "ok")

# ---------- corrupted files ----------
(out / "empty_raw.fif").write_bytes(b"")
cases["corrupt_empty"] = (["empty_raw.fif"], "reject")
(out / "random_bytes.edf").write_bytes(rng.bytes(500_000))
cases["corrupt_random_edf"] = (["random_bytes.edf"], "reject")
(out / "random_bytes_raw.fif").write_bytes(rng.bytes(500_000))
cases["corrupt_random_fif"] = (["random_bytes_raw.fif"], "reject")
full = (out / "fmt_gz_raw.fif.gz").read_bytes()
good_fif = (out / "UPPER_RAW.FIF").read_bytes()
(out / "truncated_raw.fif").write_bytes(good_fif[: len(good_fif) // 2])
cases["corrupt_truncated_fif"] = (["truncated_raw.fif"], "either")
(out / "truncated_raw.fif.gz").write_bytes(full[: len(full) // 2])
cases["corrupt_truncated_gz"] = (["truncated_raw.fif.gz"], "either")
edf = (out / "fmt_edf.edf").read_bytes()
(out / "truncated.edf").write_bytes(edf[: len(edf) // 3])
cases["corrupt_truncated_edf"] = (["truncated.edf"], "either")
(out / "header_only.edf").write_bytes(edf[:256])
cases["corrupt_edf_header_only"] = (["header_only.edf"], "reject")
(out / "text.set").write_text("this is not EEGLAB")
cases["corrupt_text_as_set"] = (["text.set"], "reject")
cases["corrupt_set_missing_fdt"] = (["fmt_eeglab.set"], "either" if not fdt else "reject")
cases["corrupt_vhdr_only"] = (["fmt_bv.vhdr"], "reject")
cases["corrupt_vmrk_eeg_no_vhdr"] = (["fmt_bv.eeg", "fmt_bv.vmrk"], "reject")
(out / "page.fif").write_text("<html><body>404 not found</body></html>")
cases["corrupt_html_as_fif"] = (["page.fif"], "reject")
(out / "notes.txt").write_text("hello")
cases["corrupt_wrong_extension"] = (["notes.txt"], "reject")
flipped = bytearray(edf)
for i in rng.integers(3000, len(flipped), 2000):
    flipped[i] ^= 0xFF
(out / "bitflips.edf").write_bytes(bytes(flipped))
cases["corrupt_bitflipped_edf"] = (["bitflips.edf"], "either")

# ---------- content edge cases ----------
save_fif("no_events", modified(lambda r: r.set_annotations(None)), "reject")
save_fif("one_event", modified(lambda r: r.set_annotations(r.annotations[10:11])))
save_fif("single_condition", modified(lambda r: r.set_annotations(r.annotations[[i for i, a in enumerate(r.annotations) if a["description"] == "stimulus/compatible"]])))


def many_codes(r):
    a = r.annotations
    r.set_annotations(mne.Annotations(a.onset, a.duration, [f"cond_{i % 10}" for i in range(len(a))]))


save_fif("ten_codes", modified(many_codes))
save_fif("events_at_edges", modified(lambda r: r.set_annotations(mne.Annotations([0.01, 0.5, 120, r.times[-1] - 0.3, r.times[-1] - 0.01], 0, ["tick"] * 5))))
save_fif("only_bad_annotations", modified(lambda r: r.set_annotations(mne.Annotations([30, 90], [20, 20], ["BAD_movement", "EDGE boundary"]))), "reject")
save_fif("duplicate_events", modified(lambda r: r.set_annotations(mne.Annotations([10, 10, 20, 20, 30, 30], 0, ["a", "b", "a", "a", "b", "b"]))))
save_fif("bad_segments", modified(lambda r: r.set_annotations(r.annotations + mne.Annotations([30, 90], [20, 20], ["BAD_movement", "BAD_movement"]))))
save_fif("very_short_3s", base.copy().crop(0, 3).set_annotations(mne.Annotations([0.5, 1.5, 2.5], 0, ["x", "y", "x"])))
save_fif("thousands_of_events", modified(lambda r: r.set_annotations(mne.Annotations(np.arange(1, 239, 0.05), 0, ["tick"] * len(np.arange(1, 239, 0.05))))))


def nan_channel(r):
    r._data[r.ch_names.index("FP1"), 1000:5000] = np.nan


save_fif("nan_segment", modified(nan_channel), "either")
save_fif("inf_values", modified(lambda r: r._data.__setitem__((3, slice(200, 210)), np.inf)), "either")
save_fif("flat_channel", modified(lambda r: r._data.__setitem__(r.ch_names.index("Cz"), 0.0)))
save_fif("all_zero", modified(lambda r: r._data.__setitem__(slice(None), 0.0)))
save_fif("huge_white_noise", modified(lambda r: add(r, rng.normal(0, 500, r._data.shape))))
save_fif("line_noise_50hz", modified(lambda r: add(r, 300 * np.sin(2 * np.pi * 50 * r.times))))
save_fif("massive_drift", modified(lambda r: add(r, 20000 + 50000 * r.times / r.times[-1])))


def spikes(r):
    idx = rng.integers(0, r.n_times, 300)
    r._data[rng.integers(0, 30, 300), idx] += 3000e-6


save_fif("random_spikes", modified(spikes))
save_fif("clipped", modified(lambda r: np.clip(r._data, -20e-6, 20e-6, out=r._data)))
save_fif("wrong_units_x1e6", modified(lambda r: r._data.__imul__(1e6)))
save_fif("wrong_units_x1e-6", modified(lambda r: r._data.__imul__(1e-6)))
save_fif("high_sfreq_2048", base.copy().crop(0, 60).resample(2048, verbose=False))
save_fif("low_sfreq_64", base.copy().resample(64, verbose=False))
long = mne.concatenate_raws([base.copy() for _ in range(7)])  # 28 min
save_fif("long_28min", long)
save_fif("no_eeg_channels", modified(lambda r: r.set_channel_types({c: "misc" for c in r.ch_names})), "reject")
save_fif("single_channel", base.copy().pick(["Cz"]))
save_fif("two_channels", base.copy().pick(["Cz", "Pz"]))
save_fif("generic_names_no_positions", modified(lambda r: (r.set_montage(None), r.rename_channels({c: f"Ch{i + 1}" for i, c in enumerate(r.ch_names)}))))
save_fif("mixed_types", modified(lambda r: r.set_channel_types({"FP1": "eog", "FP2": "eog", "P9": "emg", "P10": "ecg"})))


def stim_channel(r):
    events, _ = mne.events_from_annotations(r, verbose=False)
    r.set_annotations(None)
    info = mne.create_info(["STI 014"], r.info["sfreq"], "stim")
    stim = mne.io.RawArray(np.zeros((1, r.n_times)), info, verbose=False)
    r.add_channels([stim], force_update_info=True)
    r.add_events(events, stim_channel="STI 014")


save_fif("stim_channel_events", modified(stim_channel))


def stim_held(r):
    stim_channel(r)
    d = r._data[-1]
    for i in np.flatnonzero(d):
        d[i:i + 25] = d[i]  # codes held for 100 ms, as many amplifiers do


save_fif("stim_held_codes", modified(stim_held))

# >300 MB upload limit
big = out / "too_big_raw.fif"
with big.open("wb") as f:
    f.truncate(310 * 1024 * 1024)
cases["too_big_310mb"] = (["too_big_raw.fif"], "reject")

(out / "cases.json").write_text(json.dumps(cases, indent=1))
print(len(cases), "cases in", out)

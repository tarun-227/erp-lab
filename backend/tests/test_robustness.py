"""Uploads that are damaged, noisy or unusual, and parameter extremes: the app answers or explains, never crashes."""

import math

import mne
import numpy as np
import pytest
from fastapi.testclient import TestClient

from erp_module.api import app

client = TestClient(app)


def upload(*files: tuple[str, bytes]):
    return client.post("/api/data/upload", files=[("files", (name, data, "application/octet-stream")) for name, data in files])


def fif_bytes(tmp_path, raw: mne.io.BaseRaw) -> bytes:
    path = tmp_path / "case_raw.fif"
    raw.save(path, overwrite=True, verbose=False)
    return path.read_bytes()


def finite(x) -> bool:
    if isinstance(x, float):
        return math.isfinite(x)
    if isinstance(x, dict):
        return all(finite(v) for v in x.values())
    if isinstance(x, list):
        return all(finite(v) for v in x)
    return True


@pytest.fixture(scope="module")
def short(sample):
    raw, _, _ = sample
    return raw.copy().crop(0, 120)


@pytest.mark.parametrize("name, data", [
    ("empty_raw.fif", b""),
    ("noise_raw.fif", np.random.default_rng(0).bytes(20_000)),
    ("page.fif", b"<html>404</html>"),
    ("noise.edf", np.random.default_rng(1).bytes(20_000)),
    ("notes.set", b"not EEGLAB"),
])
def test_damaged_files_get_a_readable_message(name, data):
    res = upload((name, data))
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert name in detail
    assert "Temp" not in detail and "tmp" not in detail.lower()


def test_brainvision_without_companions_names_the_missing_files(tmp_path, short):
    mne.export.export_raw(tmp_path / "rec.vhdr", short, fmt="brainvision", verbose=False) if _has("pybv") else pytest.skip("pybv")
    res = upload(("rec.vhdr", (tmp_path / "rec.vhdr").read_bytes()))
    assert res.status_code == 422
    assert ".vmrk" in res.json()["detail"] and ".eeg" in res.json()["detail"]


def test_only_bad_annotations_means_no_events(tmp_path, short):
    raw = short.copy().set_annotations(mne.Annotations([10, 50], [5, 5], ["BAD_blink", "EDGE boundary"]))
    res = upload(("bad_raw.fif", fif_bytes(tmp_path, raw)))
    assert res.status_code == 422
    assert "No events" in res.json()["detail"]


def test_missing_samples_are_filled_marked_bad_and_reported(tmp_path, short):
    raw = short.copy()
    raw._data[raw.ch_names.index("FP1"), 15000:17500] = np.nan  # 10 s gap at 60-70 s, where events are
    raw._data[raw.ch_names.index("Cz"), 7000] = np.inf
    body = upload(("gappy_raw.fif", fif_bytes(tmp_path, raw))).json()
    assert "2501 missing samples (NaN/Inf) on FP1, Cz" in body["description"]
    codes = list(body["summary"]["event_counts"])
    res = client.post(f"/api/sessions/{body['session_id']}/process", json={
        "conditions": [{"code": int(c), "name": f"c{c}"} for c in codes], "channel": "FP1", "reject_uv": 0,
    })
    assert res.status_code == 200
    result = res.json()
    assert finite(result) and None not in result["conditions"][0]["mean"]
    assert result["drop"]["bad_span"] > 0


def test_bad_segments_are_not_counted_as_edge(tmp_path, short):
    raw = short.copy()
    raw.set_annotations(raw.annotations + mne.Annotations([30], [20], ["BAD_movement"], raw.annotations.orig_time))
    body = upload(("bad_span_raw.fif", fif_bytes(tmp_path, raw))).json()
    codes = list(body["summary"]["event_counts"])
    drop = client.post(f"/api/sessions/{body['session_id']}/process", json={
        "conditions": [{"code": int(c), "name": f"c{c}"} for c in codes],
    }).json()["drop"]
    assert drop["bad_span"] >= 5
    assert drop["edge"] <= 1
    assert drop["edge"] + drop["bad_span"] + drop["duplicate"] + drop["kept"] + drop["rejected"] == drop["total_events"]


@pytest.mark.parametrize("damage", ["noise", "line", "drift", "spikes", "flat", "zeros", "x1e6"])
def test_noisy_recordings_still_process(tmp_path, short, damage):
    raw = short.copy()
    rng = np.random.default_rng(2)
    eeg = mne.pick_types(raw.info, eeg=True)
    if damage == "noise":
        raw._data[eeg] += rng.normal(0, 500e-6, (len(eeg), raw.n_times))
    elif damage == "line":
        raw._data[eeg] += 300e-6 * np.sin(2 * np.pi * 50 * raw.times)
    elif damage == "drift":
        raw._data[eeg] += 0.02 + 0.05 * raw.times / raw.times[-1]
    elif damage == "spikes":
        raw._data[rng.integers(0, len(eeg), 300), rng.integers(0, raw.n_times, 300)] += 3e-3
    elif damage == "flat":
        raw._data[raw.ch_names.index("Cz")] = 0
    elif damage == "zeros":
        raw._data[eeg] = 0
    elif damage == "x1e6":
        raw._data[eeg] *= 1e6
    res = upload(("noisy_raw.fif", fif_bytes(tmp_path, raw)))
    assert res.status_code == 200, res.text
    body = res.json()
    sid, codes = body["session_id"], list(body["summary"]["event_counts"])
    params = {"conditions": [{"code": int(codes[0]), "name": "a"}], "channel": "Cz", "reject_uv": 0}
    for extra in ({}, {"reject_uv": 100}, {"reference": "none", "l_freq": 0, "h_freq": 0}):
        res = client.post(f"/api/sessions/{sid}/process", json={**params, **extra})
        assert res.status_code == 200, res.text
        assert finite(res.json())


def test_settings_that_do_not_fit_get_a_clear_422(tmp_path, short):
    slow = short.copy().resample(64, verbose=False)
    body = upload(("slow_raw.fif", fif_bytes(tmp_path, slow))).json()
    sid, code = body["session_id"], int(next(iter(body["summary"]["event_counts"])))
    base = {"conditions": [{"code": code, "name": "a"}]}
    res = client.post(f"/api/sessions/{sid}/process", json={**base, "h_freq": 40})
    assert res.status_code == 422 and "half the sampling rate (32 Hz)" in res.json()["detail"]
    for path, payload in [("process", {**base, "reference": "Nope"}), ("raw", {"params": {**base, "reference": "Nope"}})]:
        res = client.post(f"/api/sessions/{sid}/{path}", json=payload)
        assert res.status_code == 422 and '"Nope" is not in this recording' in res.json()["detail"]


@pytest.mark.parametrize("l_freq", [0, 0.1, 5])
@pytest.mark.parametrize("h_freq", [5, 30, 100, 0])
def test_filter_extremes_on_the_sample(sample, params, l_freq, h_freq):
    sid = client.post("/api/data/sample").json()["session_id"]
    res = client.post(f"/api/sessions/{sid}/process", json={**params, "l_freq": l_freq, "h_freq": h_freq})
    if l_freq and h_freq and l_freq >= h_freq:
        assert res.status_code == 422
    else:
        assert res.status_code == 200, res.text
        assert finite(res.json())


@pytest.mark.parametrize("window", [(-1.0, 2.0), (0.0, 0.3), (-1.0, 0.1)])
@pytest.mark.parametrize("reject", [0, 5, 1000])
def test_epoch_and_rejection_extremes(sample, params, window, reject):
    sid = client.post("/api/data/sample").json()["session_id"]
    tmin, tmax = window
    res = client.post(f"/api/sessions/{sid}/process", json={
        **params, "tmin": tmin, "tmax": tmax, "baseline_start": tmin, "baseline_end": 0.0 if tmin < 0 else 0.05,
        "peak_start": max(tmin, 0.0), "peak_end": tmax, "reject_uv": reject,
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert finite(body)
    assert body["drop"]["kept"] == sum(body["kept"])


def _has(module: str) -> bool:
    try:
        __import__(module)
        return True
    except ImportError:
        return False

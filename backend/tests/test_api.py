import io

import pytest
from fastapi.testclient import TestClient

from erp_module.api import app, store

client = TestClient(app)


@pytest.fixture(scope="module")
def loaded(sample):
    res = client.post("/api/data/sample")
    assert res.status_code == 200
    return res.json()


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_sample_loads_with_teaching_conditions(loaded):
    names = set(loaded["suggested_event_names"].values())
    assert names == {"stimulus/compatible", "stimulus/incompatible", "response/correct", "response/error"}
    assert loaded["summary"]["n_channels"] >= 28
    assert loaded["summary"]["sfreq"] == 250.0
    assert sum(loaded["summary"]["event_counts"].values()) == loaded["summary"]["n_events"]
    assert loaded["has_positions"] is True
    assert store.get(loaded["session_id"]).source == "sample"


def test_full_pipeline_round_trip(loaded, params):
    sid = loaded["session_id"]
    res = client.post(f"/api/sessions/{sid}/process", json=params)
    assert res.status_code == 200
    body = res.json()
    assert len(body["trials"]) == len(body["kept"]) == len(body["labels"])
    assert len(body["trials"][0]) == len(body["times"])
    drop = body["drop"]
    assert drop["kept"] + drop["rejected"] + drop["edge"] == drop["total_events"]
    assert [c["name"] for c in body["conditions"]] == ["correct", "error"]
    assert body["difference"]["label"] == "error − correct"

    raw = client.post(f"/api/sessions/{sid}/raw", json={"params": params, "start_s": 5, "duration_s": 10}).json()
    assert len(raw["data"]) == loaded["summary"]["n_channels"] and len(raw["data"][0]) == len(raw["times"])
    assert 5.0 <= raw["times"][0] < 5.1

    ev = client.get(f"/api/sessions/{sid}/events").json()
    assert len(ev["times_s"]) == len(ev["codes"]) == loaded["summary"]["n_events"]

    topo = client.get(f"/api/sessions/{sid}/topo").json()
    assert len(topo["weights"]) == len(topo["inside"])

    export = client.post(f"/api/sessions/{sid}/export", json=params).json()
    assert "mne.Epochs" in export["script"] and "reject=dict(eeg=150.0e-6)" in export["script"]
    assert "events_from_annotations" in export["script"]

    fif = client.get(f"/api/sessions/{sid}/recording.fif")
    assert fif.status_code == 200 and len(fif.content) > 100_000


def test_invalid_windows_are_rejected(loaded, params):
    sid = loaded["session_id"]
    bad = {**params, "baseline_start": -0.1, "baseline_end": -0.3}
    assert client.post(f"/api/sessions/{sid}/process", json=bad).status_code == 422
    bad = {**params, "l_freq": 40.0, "h_freq": 30.0}
    assert client.post(f"/api/sessions/{sid}/process", json=bad).status_code == 422
    bad = {**params, "conditions": [{"code": 1, "name": "a"}, {"code": 2, "name": "a"}]}
    assert client.post(f"/api/sessions/{sid}/process", json=bad).status_code == 422


def test_unknown_session_gives_404(params):
    assert client.post("/api/sessions/nope/process", json=params).status_code == 404


def test_upload_fif(tmp_path, sample):
    raw, _, _ = sample
    path = tmp_path / "upload_raw.fif"
    raw.copy().crop(0, 120).save(path, verbose=False)
    res = client.post("/api/data/upload", files={"files": ("upload_raw.fif", path.read_bytes(), "application/octet-stream")})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source"] == "upload"
    assert body["summary"]["n_events"] > 0
    assert set(body["suggested_event_names"].values()) <= {"stimulus/compatible", "stimulus/incompatible", "response/correct", "response/error"}


def test_upload_tidies_physionet_style_names(tmp_path, sample):
    """PhysioNet EDFs name channels "Fcz." with no positions; uploads get 10-20 names and a scalp map."""
    raw, _, _ = sample
    raw = raw.copy().crop(0, 120).set_montage(None)
    raw.rename_channels({n: n.capitalize() + "." for n in raw.ch_names if n != "STI"})
    path = tmp_path / "physionet_style_raw.fif"
    raw.save(path, verbose=False)
    res = client.post("/api/data/upload", files={"files": (path.name, path.read_bytes(), "application/octet-stream")})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["has_positions"]
    assert {"FCz", "Pz", "Fp1"} <= set(body["summary"]["ch_names"])


def test_upload_rejects_unknown_format():
    res = client.post("/api/data/upload", files={"files": ("notes.txt", io.BytesIO(b"hello"), "text/plain")})
    assert res.status_code == 422

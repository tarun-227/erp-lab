"""The three bundled samples must show the effect each one is offered for, through the app's own API."""

import subprocess
import sys

import mne
import numpy as np
import pytest
from fastapi.testclient import TestClient

from erp_module.api import SAMPLES, app
from erp_module.core import codegen, io, pipeline
from erp_module.core.processing import preprocess

client = TestClient(app)


class Loaded:
    def __init__(self, name: str):
        res = client.post("/api/data/sample", json={"sample": name})
        assert res.status_code == 200, res.text
        self.body = res.json()
        self.sid = self.body["session_id"]
        self.codes = {v: int(k) for k, v in self.body["suggested_event_names"].items()}

    def process(self, conditions: list[str], channel: str, window: tuple[float, float], polarity="positive", **extra) -> dict:
        res = client.post(f"/api/sessions/{self.sid}/process", json={
            "conditions": [{"code": self.codes[c], "name": c} for c in conditions],
            "channel": channel, "peak_start": window[0], "peak_end": window[1], "polarity": polarity,
            "reject_uv": 150, **extra,
        })
        assert res.status_code == 200, res.text
        return res.json()


@pytest.fixture(scope="module")
def flanker():
    return Loaded("flanker")


@pytest.fixture(scope="module")
def oddball():
    return Loaded("oddball")


@pytest.fixture(scope="module")
def ssvep():
    return Loaded("ssvep")


def dominant_hz(result: dict, condition: int) -> float:
    """The strongest rhythm between 8 and 20 Hz in a condition's average, after time zero."""
    t = np.array(result["times"])
    wave = np.array(result["conditions"][condition]["mean"])[t >= 0]
    freqs = np.fft.rfftfreq(4 * len(wave), t[1] - t[0])
    spectrum = np.abs(np.fft.rfft(wave * np.hanning(len(wave)), 4 * len(wave)))
    band = (freqs > 8) & (freqs < 20)
    return float(freqs[band][spectrum[band].argmax()])


def swing(result: dict, condition: int) -> float:
    t = np.array(result["times"])
    wave = np.array(result["conditions"][condition]["mean"])[t >= 0]
    return float(wave.max() - wave.min())


def test_health_lists_every_sample():
    assert client.get("/api/health").json()["samples"] == {"flanker": True, "oddball": True, "ssvep": True}


@pytest.mark.parametrize("name, events, n_channels", [
    ("flanker", {"stimulus/compatible", "stimulus/incompatible", "response/correct", "response/error"}, 30),
    ("oddball", {"tone/standard", "tone/oddball", "sound/noise", "response/keypress"}, 32),
    ("ssvep", {"flicker/12 Hz", "flicker/15 Hz"}, 32),
])
def test_each_sample_loads_with_its_events_and_a_scalp_map(name, events, n_channels):
    body = Loaded(name).body
    assert body["sample_id"] == name
    assert body["source"] == "sample"
    assert body["has_positions"]
    assert set(body["suggested_event_names"].values()) == events
    assert body["summary"]["n_channels"] == n_channels
    assert body["summary"]["sfreq"] == 250.0


def test_no_body_still_means_the_flanker_sample():
    assert client.post("/api/data/sample").json()["sample_id"] == "flanker"


def test_unknown_sample_is_rejected():
    assert client.post("/api/data/sample", json={"sample": "nope"}).status_code == 422


def test_flanker_shows_the_ern(flanker):
    result = flanker.process(["response/correct", "response/error"], "FCz", (0.0, 0.1), "negative", tmin=-0.6, tmax=0.6, baseline_start=-0.4, baseline_end=-0.2)
    peak = result["difference"]["peak"]
    assert peak["amplitude_uv"] < -5
    assert 0 <= peak["latency_s"] <= 0.1


def test_flanker_shows_a_p3(flanker):
    result = flanker.process(["stimulus/compatible", "stimulus/incompatible"], "Pz", (0.3, 0.6))
    for condition in result["conditions"]:
        assert condition["peak"]["amplitude_uv"] > 3 * condition["sme_uv"]


def test_oddball_shows_a_p300_over_central_parietal_sites(oddball):
    conditions = ["tone/standard", "tone/oddball"]
    result = oddball.process(conditions, "CPz", (0.25, 0.6))
    diff = result["difference"]
    assert diff["mean_amplitude_uv"] > 5 * diff["sme_uv"]
    assert 0.3 <= diff["peak"]["latency_s"] <= 0.5
    frontal = oddball.process(conditions, "Fz", (0.25, 0.6))["difference"]
    assert diff["mean_amplitude_uv"] > frontal["mean_amplitude_uv"] + 5

    # The r² map finds the same effect on its own: the strongest cell is central-parietal, 300-500 ms.
    map_ = result["discriminability"]
    values = np.array(map_["values"])
    channel, sample = np.unravel_index(np.abs(values).argmax(), values.shape)
    assert map_["ch_names"][channel] in {"CP1", "CPz", "CP2", "P3", "Pz", "P4"}
    assert 0.3 <= result["times"][sample] <= 0.5
    assert values[channel, sample] > 0


def test_oddball_shows_an_n1_to_every_sound(oddball):
    result = oddball.process(["tone/standard", "tone/oddball"], "Cz", (0.07, 0.15), "negative")
    standard = result["conditions"][0]
    assert standard["peak"]["amplitude_uv"] < -3 * standard["sme_uv"]
    assert 0.08 <= standard["peak"]["latency_s"] <= 0.14


def test_noise_bursts_respond_earlier_and_more_centrally_than_targets(oddball):
    noise = oddball.process(["tone/standard", "sound/noise"], "Cz", (0.2, 0.45))["difference"]
    target = oddball.process(["tone/standard", "tone/oddball"], "CPz", (0.25, 0.6))["difference"]
    assert noise["mean_amplitude_uv"] > 3 * noise["sme_uv"]
    assert noise["peak"]["latency_s"] < target["peak"]["latency_s"] - 0.03


def test_ssvep_follows_the_flicker_frequency(ssvep):
    result = ssvep.process(["flicker/12 Hz", "flicker/15 Hz"], "O2", (0.0, 0.8), l_freq=1, h_freq=40)
    assert [c["n_kept"] for c in result["conditions"]] == [180, 180]
    assert dominant_hz(result, 0) == pytest.approx(12, abs=0.5)
    assert dominant_hz(result, 1) == pytest.approx(15, abs=0.5)


def test_ssvep_is_largest_over_the_back_of_the_head(ssvep):
    conditions = ["flicker/12 Hz", "flicker/15 Hz"]
    occipital = ssvep.process(conditions, "O2", (0.0, 0.8), l_freq=1, h_freq=40)
    central = ssvep.process(conditions, "Cz", (0.0, 0.8), l_freq=1, h_freq=40)
    for i in range(2):
        assert swing(occipital, i) > 3 * swing(central, i)


@pytest.mark.parametrize("name, conditions", [
    ("oddball", {"standard": "tone/standard", "target": "tone/oddball"}),
    ("ssvep", {"slow": "flicker/12 Hz", "fast": "flicker/15 Hz"}),
])
def test_exported_script_reproduces_each_new_sample(tmp_path, name, conditions):
    raw, events, names = io.prepare(mne.io.read_raw_fif(SAMPLES[name][0], preload=True, verbose=False))
    codes = {v: int(k) for k, v in names.items()}
    params = {
        "conditions": [{"code": codes[event], "name": label} for label, event in conditions.items()],
        "l_freq": 1.0, "h_freq": 40.0, "reference": "average", "tmin": -0.2, "tmax": 0.8, "baseline": True,
        "baseline_start": -0.2, "baseline_end": 0.0, "reject_uv": 150.0, "channel": "Pz",
        "peak_start": 0.25, "peak_end": 0.5, "polarity": "positive",
    }
    app_result = pipeline.process(preprocess(raw, 1.0, 40.0, "average"), events, params)
    raw.save(tmp_path / "recording_raw.fif", overwrite=True, verbose=False)
    script = tmp_path / "erp_pipeline.py"
    script.write_text(codegen.make_script(params, {c["name"]: c["code"] for c in params["conditions"]}, uses_stim_channel=False), encoding="utf-8")
    run = subprocess.run([sys.executable, str(script), "recording_raw.fif", "--no-plot"], cwd=tmp_path, capture_output=True, text=True, timeout=600)
    assert run.returncode == 0, run.stderr
    evokeds = {e.comment: e for e in mne.read_evokeds(tmp_path / "erp-ave.fif", verbose=False)}
    for condition in app_result["conditions"]:
        evoked = evokeds[condition["name"]]
        assert evoked.nave == condition["n_kept"]
        np.testing.assert_allclose(evoked.copy().pick(["Pz"]).data[0] * 1e6, condition["mean"], atol=0.01)

import numpy as np

from erp_module.core import erp, pipeline
from erp_module.core.processing import preprocess


def test_noise_shrinks_like_one_over_root_n():
    rng = np.random.default_rng(1)
    trials = rng.normal(0, 10, (400, 200))
    ns = [4, 16, 64]
    noise = erp.residual_noise(trials, np.ones(200, bool), ns)
    for n, measured in zip(ns, noise):
        assert abs(measured - 10 / np.sqrt(n)) / (10 / np.sqrt(n)) < 0.15
    assert noise[0] / noise[2] > 3.5  # 16 times the trials -> about 4 times less noise


def test_find_peak_respects_window_and_polarity():
    times = np.linspace(0, 1, 101)
    wave = np.sin(2 * np.pi * times)  # +1 at 0.25 s, -1 at 0.75 s
    assert erp.find_peak(times, wave, (0.0, 0.5), "positive")["latency_s"] == 0.25
    assert erp.find_peak(times, wave, (0.5, 1.0), "negative")["latency_s"] == 0.75
    assert erp.find_peak(times, wave, (2.0, 3.0), "positive") is None


def test_confidence_interval_narrows_with_more_trials():
    rng = np.random.default_rng(2)
    _, ci_small = erp.average_with_ci(rng.normal(0, 5, (10, 50)))
    _, ci_large = erp.average_with_ci(rng.normal(0, 5, (160, 50)))
    assert ci_large.mean() < ci_small.mean() / 3


def _run(sample, params):
    raw, events, _ = sample
    pre = preprocess(raw, params["l_freq"], params["h_freq"], params["reference"])
    return pipeline.process(pre, events, params)


def test_pipeline_finds_the_ern_after_errors(sample, params):
    out = _run(sample, params)
    assert out["channel"] == "FCz"
    assert len(out["trials"]) == len(out["kept"]) == len(out["labels"]) == len(out["event_times_s"])
    errors = next(c for c in out["conditions"] if c["name"] == "error")
    assert errors["n_kept"] >= 10
    # The ERN: errors are more negative than correct responses at FCz within 100 ms of the response.
    assert out["difference"]["label"] == "error − correct"
    assert out["difference"]["peak"]["amplitude_uv"] < -2
    assert out["difference"]["mean_amplitude_uv"] < 0
    assert np.array(errors["topo_mean"]).shape == (len(out["ch_names"]), len(out["times"]))


def test_pipeline_finds_a_p3_after_stimuli(sample, codes, params):
    stim = {
        **params,
        "conditions": [{"code": codes["stimulus/compatible"], "name": "compatible"}, {"code": codes["stimulus/incompatible"], "name": "incompatible"}],
        "tmin": -0.2, "tmax": 0.8, "baseline_start": -0.2, "baseline_end": 0.0,
        "channel": "Pz", "peak_start": 0.3, "peak_end": 0.6, "polarity": "positive",
    }
    out = _run(sample, stim)
    for cond in out["conditions"]:
        assert cond["peak"]["amplitude_uv"] > 2


def test_signed_r2_matches_point_biserial_correlation():
    from scipy.stats import pointbiserialr

    rng = np.random.default_rng(3)
    a = rng.normal(0, 1, (30, 5))
    b = rng.normal(0.8, 1, (20, 5))
    r2 = erp.signed_r2(a, b)
    labels = np.r_[np.zeros(30), np.ones(20)]
    for j in range(5):
        r, _ = pointbiserialr(labels, np.r_[a[:, j], b[:, j]])
        assert np.isclose(r2[j], np.sign(r) * r**2)
    assert (r2 > 0).sum() >= 4  # b is larger, so the sign follows b − a


def test_sme_is_sd_of_trial_scores_over_root_n():
    times = np.linspace(0, 1, 11)
    trials = np.array([[1.0] * 11, [3.0] * 11, [5.0] * 11, [7.0] * 11])
    sme = erp.sme_mean_amplitude(trials, times, (0.2, 0.6))
    assert np.isclose(sme, np.std([1, 3, 5, 7], ddof=1) / 2)


def test_area_latency_splits_the_component_area_in_half():
    times = np.linspace(0, 1, 1001)
    wave = -np.exp(-((times - 0.4) ** 2) / 0.002)  # symmetric negative bump at 400 ms
    assert abs(erp.area_latency(times, wave, (0.2, 0.6), "negative") - 0.4) < 0.002
    assert erp.area_latency(times, wave, (0.2, 0.6), "positive") is None  # no positive area


def test_signed_r2_map_shows_the_ern_and_sme_is_reported(sample, params):
    out = _run(sample, params)
    disc = out["discriminability"]
    assert disc["label"] == "error − correct"
    values = np.array(disc["values"])
    assert values.shape == (len(out["ch_names"]), len(out["times"]))
    assert disc["ch_names"][0].upper().startswith("FP")  # ordered front to back
    times = np.array(out["times"])
    fcz = values[disc["ch_names"].index("FCz")]
    assert fcz[(times >= 0) & (times <= 0.1)].min() < -0.02  # errors more negative right after the response
    errors = next(c for c in out["conditions"] if c["name"] == "error")
    correct = next(c for c in out["conditions"] if c["name"] == "correct")
    assert errors["sme_uv"] > correct["sme_uv"] > 0  # far fewer error trials, so a noisier score
    assert 0 <= out["difference"]["area50_latency_s"] <= 0.1

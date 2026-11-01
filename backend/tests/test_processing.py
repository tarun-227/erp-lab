import numpy as np
import pytest

from erp_module.core.processing import make_epochs, preprocess


@pytest.fixture(scope="module")
def pre(sample):
    raw, _, _ = sample
    return preprocess(raw, 0.1, 30.0, "average")


def _epochs(pre, sample, codes, reject_uv=150.0, baseline=(-0.2, 0.0)):
    _, events, _ = sample
    event_id = {"compatible": codes["stimulus/compatible"], "incompatible": codes["stimulus/incompatible"]}
    return make_epochs(pre, events, event_id, -0.2, 0.8, baseline, reject_uv)


def test_baseline_window_averages_to_zero(pre, sample, codes):
    res = _epochs(pre, sample, codes)
    data = res.epochs.get_data(copy=False)
    base = res.epochs.times <= 0.0
    assert np.abs(data[..., base].mean(axis=-1)).max() < 1e-12


def test_drop_counts_add_up(pre, sample, codes):
    drop = _epochs(pre, sample, codes).drop_summary()
    assert drop["kept"] + drop["rejected"] + drop["edge"] == drop["total_events"]
    assert sum(drop["by_channel"].values()) == drop["rejected"]


def test_rejection_matches_the_peak_to_peak_rule(pre, sample, codes):
    res = _epochs(pre, sample, codes, reject_uv=80.0)
    assert (~res.kept).any()
    assert (res.ptp_uv[res.kept] <= 80.0).all()
    assert (res.ptp_uv[~res.kept].max(axis=1) > 80.0).all()
    for i in np.flatnonzero(~res.kept):  # each rejection is blamed on its largest swing
        assert res.ptp_uv[i, res.epochs.ch_names.index(res.worst_channel[i])] == res.ptp_uv[i].max()


def test_no_threshold_keeps_everything(pre, sample, codes):
    assert _epochs(pre, sample, codes, reject_uv=None).kept.all()


def test_stricter_threshold_never_keeps_more(pre, sample, codes):
    assert _epochs(pre, sample, codes, reject_uv=60.0).kept.sum() <= _epochs(pre, sample, codes, reject_uv=150.0).kept.sum()


def test_filters_change_the_signal(sample):
    raw, _, _ = sample
    a = preprocess(raw, 0.1, 30.0, "average").get_data(picks="eeg", stop=2000)
    b = preprocess(raw, 2.0, 30.0, "average").get_data(picks="eeg", stop=2000)
    assert not np.allclose(a, b)
    ref = preprocess(raw, None, None, "Cz")
    assert np.allclose(ref.get_data(picks=["Cz"]), 0)  # the reference channel is flat by definition

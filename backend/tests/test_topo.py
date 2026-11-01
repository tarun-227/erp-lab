import numpy as np

from erp_module.core import topo


def test_layout_has_weights_for_every_grid_point_inside_the_head(sample):
    raw, _, _ = sample
    lay = topo.layout(raw.info, resolution=30)
    assert lay is not None
    n_eeg = len(raw.copy().pick("eeg").ch_names)
    assert len(lay["ch_names"]) == n_eeg
    assert np.array(lay["weights"]).shape == (len(lay["inside"]), n_eeg)


def test_projection_puts_cz_at_centre_and_fz_in_front(sample):
    raw, _, _ = sample
    lay = topo.layout(raw.info)
    xy = dict(zip(lay["ch_names"], zip(lay["x"], lay["y"])))
    assert np.hypot(*xy["Cz"]) < 0.2
    assert xy["Fz"][1] > xy["Cz"][1] > xy["Pz"][1]
    assert xy["C4"][0] > xy["Cz"][0] > xy["C3"][0]


def test_thin_plate_spline_passes_through_the_electrodes():
    rng = np.random.default_rng(0)
    xy = rng.uniform(-1, 1, (12, 2))
    values = rng.normal(size=12)
    w = topo.interpolation_matrix(xy, xy)
    np.testing.assert_allclose(w @ values, values, atol=1e-6)

import mne
import pytest

from erp_module.api import SAMPLE_FILE
from erp_module.core import io


@pytest.fixture(scope="session")
def sample():
    """The bundled ERP CORE recording, prepared exactly as the app loads it: (raw, events, names)."""
    if not SAMPLE_FILE.exists():
        pytest.skip("data/sample_erp_raw.fif is missing: run python scripts/make_sample_data.py")
    return io.prepare(mne.io.read_raw_fif(SAMPLE_FILE, preload=True, verbose=False))


@pytest.fixture(scope="session")
def codes(sample):
    """Event code for each condition name, e.g. codes["response/error"]."""
    _, _, names = sample
    return {name: int(code) for code, name in names.items()}


@pytest.fixture
def params(codes):
    """The app's ERN preset: error vs correct responses at FCz, 0-100 ms, negative peak."""
    return {
        "conditions": [{"code": codes["response/correct"], "name": "correct"}, {"code": codes["response/error"], "name": "error"}],
        "l_freq": 0.1,
        "h_freq": 30.0,
        "reference": "average",
        "tmin": -0.6,
        "tmax": 0.6,
        "baseline": True,
        "baseline_start": -0.4,
        "baseline_end": -0.2,
        "reject_uv": 150.0,
        "channel": "FCz",
        "peak_start": 0.0,
        "peak_end": 0.1,
        "polarity": "negative",
    }

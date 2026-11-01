import subprocess
import sys

import mne
import numpy as np

from erp_module.core import codegen, pipeline
from erp_module.core.processing import preprocess


def test_exported_script_reproduces_the_app_erp(tmp_path, sample, params):
    raw, events, _ = sample
    params = {**params, "reject_uv": 120.0, "l_freq": 0.5, "h_freq": 20.0}
    event_id = {c["name"]: c["code"] for c in params["conditions"]}

    pre = preprocess(raw, params["l_freq"], params["h_freq"], params["reference"])
    app = pipeline.process(pre, events, params)

    # The file the app offers for download is the prepared recording itself.
    raw.save(tmp_path / "recording_raw.fif", overwrite=True, verbose=False)
    script = tmp_path / "erp_pipeline.py"
    script.write_text(codegen.make_script(params, event_id, uses_stim_channel=False), encoding="utf-8")
    run = subprocess.run(
        [sys.executable, str(script), "recording_raw.fif", "--no-plot"],
        cwd=tmp_path, capture_output=True, text=True, timeout=600,
    )
    assert run.returncode == 0, run.stderr

    evokeds = {e.comment: e for e in mne.read_evokeds(tmp_path / "erp-ave.fif", verbose=False)}
    for cond in app["conditions"]:
        evoked = evokeds[cond["name"]]
        assert evoked.nave == cond["n_kept"]
        script_wave = evoked.copy().pick([app["channel"]]).data[0] * 1e6
        np.testing.assert_allclose(script_wave, cond["mean"], atol=0.01)

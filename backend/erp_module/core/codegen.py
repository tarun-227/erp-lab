"""Turn the app's parameters into a standalone MNE script that reproduces the ERP."""

from __future__ import annotations

from datetime import date


def make_script(params: dict, event_id: dict[str, int], uses_stim_channel: bool, stim_channel: str = "STI") -> str:
    """`params` holds the processing parameters (see schemas.ProcessParams)."""
    l_freq, h_freq = params.get("l_freq") or None, params.get("h_freq") or None
    reference = params["reference"]
    baseline = (params["baseline_start"], params["baseline_end"]) if params["baseline"] else None
    reject = f"dict(eeg={params['reject_uv']}e-6)" if params.get("reject_uv") else "None"
    window = (params["peak_start"], params["peak_end"])
    mode = "pos" if params["polarity"] == "positive" else "neg"
    channel = params["channel"]

    if uses_stim_channel:
        events_code = f'events = mne.find_events(raw, stim_channel="{stim_channel}", shortest_event=1)'
    else:
        events_code = "events, _ = mne.events_from_annotations(raw)"

    if l_freq or h_freq:
        filter_code = f'raw.filter(l_freq={l_freq!r}, h_freq={h_freq!r}, picks="eeg")'
    else:
        filter_code = "# No filtering"

    if reference == "average":
        ref_code = 'raw.set_eeg_reference("average", projection=False)'
    elif reference == "none":
        ref_code = "# Keep the recording reference"
    else:
        ref_code = f"raw.set_eeg_reference([{reference!r}])"

    return f'''"""ERP pipeline exported from ERP Lab on {date.today().isoformat()}.

Reproduces the epochs and ERPs shown in the app.
Run:   python erp_pipeline.py [recording_raw.fif]
Needs: pip install mne matplotlib
"""

import sys

import mne

DATA_FILE = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "recording_raw.fif"

# 1. Load the recording and its events
raw = mne.io.read_raw_fif(DATA_FILE, preload=True)
{events_code}
event_id = {event_id!r}

# 2. Band-pass filter
{filter_code}

# 3. Re-reference
{ref_code}

# 4. Cut epochs, baseline-correct and reject large artefacts (peak-to-peak)
epochs = mne.Epochs(
    raw, events, event_id,
    tmin={params["tmin"]!r}, tmax={params["tmax"]!r},
    baseline={baseline!r},
    picks="eeg",
    reject={reject},
    preload=True,
    event_repeated="drop",
)
print(epochs)

# 5. Average each condition into an ERP
evokeds = {{name: epochs[name].average() for name in event_id if len(epochs[name])}}
mne.write_evokeds("erp-ave.fif", list(evokeds.values()), overwrite=True)

# 6. Peak latency and amplitude at {channel}, {window[0] * 1000:.0f}-{window[1] * 1000:.0f} ms
for name, evoked in evokeds.items():
    _, latency, amplitude = evoked.copy().pick([{channel!r}]).get_peak(
        tmin={window[0]!r}, tmax={window[1]!r}, mode="{mode}", return_amplitude=True
    )
    print(f"{{name}}: peak {{amplitude * 1e6:.2f}} µV at {{latency * 1000:.0f}} ms")

# 7. Plot
if "--no-plot" not in sys.argv:
    mne.viz.plot_compare_evokeds(evokeds, picks={channel!r})
    for evoked in evokeds.values():
        evoked.plot_joint()
'''

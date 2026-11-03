# ERP Lab user guide

ERP Lab teaches how continuous EEG becomes an event-related potential (ERP). You work through six steps,
left to right. Every plot updates as you move a slider, and clicking in one plot updates the others.

Start it with `python run.py` and open http://localhost:8000. On your first visit a four-stop tour points
out the main areas; you can skip it.

## The screen

| Area | What it holds |
|---|---|
| Top bar | The six steps (keys **1–6** jump between them), the light/dark toggle, and the book icon that opens the side panel |
| Left panel | The controls for the current step. Hover any ⓘ for a short explanation. Drag its right edge to resize it (or focus the edge and use ← / →, Shift for bigger steps; double-click resets), and collapse it to a slim rail with the panel button or the **[** key. Its width is remembered |
| Centre | The plots for the current step |
| Right panel | **Explain**: background, "Try this" ideas and questions for the current step. **Tutor**: the AI tutor (optional) |

Every plot has an **Explain this plot** button (asks the tutor about that plot), an **Enlarge** button that
opens it almost full-screen (Esc or Close returns it), and Plotly's toolbar (zoom, pan, and the camera icon
to save a PNG). For the biggest plots, collapse the left panel and close the Guide.

## 1. Load data

Pick a source:

- **Sample recording**: one participant from the ERP CORE flanker task. A central arrow is flanked by
  arrows pointing the same way (compatible) or the other way (incompatible); the participant presses a button
  for the central arrow. It has stimulus events (compatible / incompatible) and response events (correct /
  error presses). Errors are followed by the error-related negativity (ERN) at FCz; stimuli evoke a P3 at Pz.
- **Your own file**: `.fif`, `.edf`, `.bdf`, EEGLAB `.set` (upload the `.fdt` with it) or BrainVision
  `.vhdr` (with its `.eeg` and `.vmrk`). The file needs a stim channel or annotations. Recordings longer than
  20 minutes are trimmed and fast recordings are resampled to 250 Hz.

The summary shows channels, sampling rate, duration and the events found.

## 2. Events

Tick the event codes you want to analyse and name them; each becomes one condition with its own colour
throughout the app. The timeline shows when every event happened; drag the slider under it to zoom.
**Quick start** (on this step) sets up a standard analysis across all the later steps in one click (*ERN (errors vs correct)* or *Flanker P3*); **Undo** reverts the last preset or suggestion.

## 3. Epoching

Parameters:

| Parameter | What it does |
|---|---|
| Epoch window | How much signal to cut around each event |
| Baseline correction / window | Subtracts each epoch's mean in this window |
| High-pass / Low-pass | Band-pass filter applied to the continuous EEG before epoching |
| Reference | Average reference, the recording reference, or a single channel |
| Peak-to-peak threshold | Drops epochs whose voltage swing on any channel exceeds it (0 = off) |
| Channel shown | The electrode plotted in the ERP image and ERP |

Plots:

- **Continuous EEG with epoch windows**: every channel, with each epoch shaded (condition colour = kept,
  red = rejected). Use the arrows or the slider below it to move through the recording. Click a shaded box
  to select that trial.
- **ERP image**: one row per epoch at the chosen channel; rejected rows are grey. Click a row to jump to it
  in the raw signal; the subtitle says why it was rejected.
- **Why epochs were dropped**: rejected epochs per channel (blinks show up on Fp1/Fp2) and epochs too close
  to the edge of the recording.

A notification appears whenever a change alters how many epochs are kept.

## 4. ERP

- **ERP plot**: the average of each condition with a 95% confidence band, the peak (diamond) inside the
  shaded peak window, and the difference wave. Click anywhere to move the time cursor (or use ← / →).
  **Pin to compare** keeps the current curves as dashed lines so you can change a setting and see the
  difference. **Neg. up** flips the y-axis, a common ERP convention.
- **Scalp map**: the voltage over the head at the cursor time, for one condition or the difference. Press
  **Play** to animate it. Click an electrode to plot its ERP.
- **Where and when do the conditions differ? (signed r²)**: every channel (front to back) × time, coloured by how
  well the voltage separates the two conditions trial by trial; red where the second condition is more positive.
  This is the standard BCI view for choosing channels and time windows (Blankertz et al., 2011). Click a cell to
  plot that channel and move the time cursor there.
- **Measurements table**: trials, mean amplitude, its standardized measurement error (SME, Luck et al. 2021),
  peak latency, peak amplitude and 50% area latency, per condition and for the difference. Hover a column name
  for its definition.
- Every waveform plot states its reference, filter and baseline, and the scalp map states its interpolation and
  reference, as the Keil et al. (2014) publication checklist asks.
- **Why averaging works**: the noise left after averaging N trials, against the 1/√N prediction.

In the left panel, **Component** buttons set a typical window (N1, P300, ERN, and Pe, the error positivity after the ERN) and **Trials
averaged** uses only the first N kept trials of each condition. Slide it from 1 upwards to watch the ERP
emerge from the noise.

## 5. Learn & Quiz

- Six concept cards (click to expand).
- **Try this** experiments in the left panel: each changes the settings for you and opens the plot that
  shows the effect. Undo puts the settings back.
- An eight-question quiz with instant feedback. Your answers are remembered in this browser.
- With the tutor enabled: questions generated from your own results, and feedback on a short written answer.

## 6. Export

- **Recording**: the EEG and events as `recording_raw.fif`.
- **erp_pipeline.py**: a standalone MNE-Python script with your exact parameters. Run
  `python erp_pipeline.py recording_raw.fif`; it prints the peaks, saves `erp-ave.fif` and plots the ERPs.
  It reproduces the app's numbers exactly (this is checked by an automated test).
- **Parameters**: save them as JSON, or load a saved file.
- **Share link**: a URL that opens the app with your settings (parameters only, never data).
- **Results**: the ERP waveforms at the current channel as CSV.

## The AI tutor (optional)

The tutor is off unless the person running the app adds free API keys (see the README). When it is on:

- It sees your current step, parameters and summary numbers (kept/rejected counts, peaks), never the raw EEG.
- **Socratic mode** (on by default) gives hints and questions before answers.
- It can suggest an experiment as a card with **Apply** and **Undo**; it never changes anything by itself.
- **Explain this plot** sends a picture of the plot (to Gemini, if a Gemini key is set) together with the numbers.

AI answers can be wrong; check them against the plots.

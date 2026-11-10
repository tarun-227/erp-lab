# ERP Lab: Project Report and Technical Documentation

**Course:** CS5109 Brain–Computer Interfaces
**Assignment:** Option A (web-app teaching module), Topic 4: Epoching and ERP
**Repository:** https://github.com/tarun-227/erp-lab
**Version documented:** commit `2c02386`, branch `main`

| Member | Roll number | Role |
|---|---|---|
| [fill in] | [fill in] | [fill in] |
| [fill in] | [fill in] | [fill in] |
| [fill in] | [fill in] | [fill in] |
| [fill in] | [fill in] | [fill in] |

---

## 1. Summary

ERP Lab is an interactive web application that teaches how event-related potentials (ERPs) are extracted from
continuous EEG. A student loads real EEG, chooses which events to study, cuts the signal into epochs, averages
them, and sees the brain response appear. Every setting can be changed with a slider, and the linked plots
update in response, so the effect of each analysis decision is visible immediately.

The app has six guided steps, three bundled real recordings from different kinds of experiment, upload of the
student's own files, a plain-language guide with questions on every step, a quiz, an optional AI tutor that
knows the student's current results, and export of a standalone Python script that reproduces the analysis.

The backend does the signal processing with MNE-Python. The frontend is React and TypeScript with Plotly. The
project has 121 automated tests, and all of them pass.

## 2. Requirements and how they are met

| Course requirement | How it is met | Where |
|---|---|---|
| Sample data plus own file upload | Three bundled recordings; upload of `.fif`, `.fif.gz`, `.edf`, `.bdf`, `.set`, `.vhdr`, `.gdf`, `.cnt` | `frontend/src/steps/LoadStep.tsx`, `backend/erp_module/api.py` |
| 5+ adjustable parameters | Epoch window, baseline on/off and window, high-pass, low-pass, reference, rejection threshold, channel, peak window, polarity, trials averaged, conditions | Section 8.2 |
| 2 linked, live-updating plots | Raw signal linked to ERP image; ERP waveform linked to scalp map; r² map linked to both channel and time | Section 8.3 |
| "Explain" panel with questions | Guide tab on every step with an explanation, "Try this" tasks and "Think about it" questions | `frontend/src/content/explain.ts` |
| Export of code and parameters | Python script, parameters as JSON, share link, ERP as CSV, recording as FIF | `frontend/src/steps/ExportStep.tsx` |
| One-line run command | `python run.py` (after `pip install -r requirements.txt`) | `run.py` |
| README with user and developer guides | `README.md`, `docs/USER_GUIDE.md`, `docs/DEVELOPER_GUIDE.md` | `docs/` |
| At least 3 automated tests | 94 backend, 21 frontend, 6 browser tests | Section 11 |
| 10-minute demo | Script with one part per speaker | `docs/DEMO.md` |
| One-page contribution statement | Template ready; names, roll numbers and sign-off still to be filled in | `CONTRIBUTION.md` |
| Module merged in the shared repository | **Not done yet.** Mount and embed examples are ready; the shared repository's address and format are needed | `integration/` |

## 3. Background

An ERP is a small voltage change, usually a few microvolts, that is time-locked to an event such as a stimulus
or a response. It is buried in background EEG roughly ten times larger, so it cannot normally be seen in a
single trial. The standard method repeats the event many times, cuts out the EEG around each one, and
averages: activity locked to the event remains, and activity that is not locked averages towards zero. Random
noise in the average falls by about 1/√N, where N is the number of trials.

Each analysis choice changes the result, and showing that is the purpose of this module:

| Step | What it does | What can go wrong |
|---|---|---|
| Band-pass filter | Removes slow drift and fast noise | A high-pass above about 1 Hz shrinks and distorts slow components such as the P300 |
| Re-reference | Sets what each voltage is measured against | Changes the amplitude at every electrode |
| Epoching | Cuts a window around each event | A window running past the recording's edge cannot be cut |
| Baseline correction | Subtracts the pre-event mean | A baseline that includes the response subtracts part of the response |
| Artefact rejection | Drops epochs with a large peak-to-peak swing | Too strict a threshold discards good data and raises the noise |
| Averaging | Reveals the time-locked response | Rare conditions have fewer trials and noisier averages |

## 4. System overview

```
Browser (React + TypeScript)                     Server (FastAPI + MNE-Python)
┌────────────────────────────────┐   JSON       ┌───────────────────────────────────┐
│ Six step screens               │ ───────────► │ api.py       routes                │
│ Plotly plots, linked by a      │              │ sessions.py  sessions, filter cache│
│ shared store (Zustand)         │ ◄─────────── │ core/        loading, processing,  │
│ TanStack Query for requests    │   arrays     │              ERP maths, scalp map, │
│ Cheap updates in the browser   │              │              script generator      │
│ (trial averaging, scalp map)   │   SSE        │ tutor/       context, routing,     │
│ Guide, Tutor, Quiz             │ ◄──────────► │              tools, streaming      │
└────────────────────────────────┘              └──────────────┬────────────────────┘
                                                               │ summaries, plot image
                                                     Gemini, with Groq as backup, optional
```

The work is split so that the interface stays responsive. The server does filtering and epoching, which are
expensive, and returns compact arrays. The browser then handles frequent, cheap interactions itself: it
recomputes the average for the "Trials averaged" slider from the single trials it already holds, and it draws
the scalp map at any moment by multiplying a precomputed interpolation matrix by the channel values.

### Technology and versions installed

| Layer | Technology | Version |
|---|---|---|
| Language (backend) | Python | 3.12.4 |
| EEG processing | MNE-Python | 1.13.2 |
| Numerics | NumPy / SciPy | 2.5.4 / 1.18.1 |
| Web API | FastAPI / Uvicorn / Pydantic | 0.162.0 / 0.54.0 / 2.14.2 |
| LLM client | OpenAI Python SDK, pointed at Groq and Gemini | 3.42.0 |
| Runtime (frontend) | Node.js | 24.15.0 (project requires 22+) |
| UI | React / TypeScript / Vite | 19.3.1 / 7.0.2 / 8.3.5 |
| Styling and components | Tailwind CSS, shadcn/ui on Base UI | 4.3.3, Base UI 1.9.0 |
| State and data | Zustand / TanStack Query | ^5.0.16 declared / 5.105.0 |
| Plots | Plotly.js (`plotly.js-dist-min`), loaded lazily | 4.2.0 |
| Tests | pytest, Vitest, Playwright, axe | Vitest 5.0.5, Playwright 1.64.1 |

Developed and tested on Windows 11 Home (build 26200) with Microsoft Edge. Continuous integration runs on
Ubuntu with Python 3.12, Node 22 and Chromium.

### Source layout

| Path | Contents |
|---|---|
| `backend/erp_module/api.py` | HTTP routes; `create_app()` so the module can be mounted under a prefix |
| `backend/erp_module/schemas.py` | Request and response models with validation |
| `backend/erp_module/sessions.py` | Session store, shared filter cache, newest-request-only logic |
| `backend/erp_module/core/io.py` | Reading files, finding events, repairing missing data, preparing recordings |
| `backend/erp_module/core/processing.py` | Filter, reference, epoching, rejection, drop counts |
| `backend/erp_module/core/erp.py` | Averages, confidence intervals, peaks, SME, area latency, signed r² |
| `backend/erp_module/core/pipeline.py` | Combines the above into one response |
| `backend/erp_module/core/topo.py` | Thin-plate-spline scalp-map interpolation |
| `backend/erp_module/core/codegen.py` | Generates the exported Python script |
| `backend/erp_module/tutor/` | LLM client and routing, context, prompts, tools, streaming routes |
| `frontend/src/steps/` | The six step screens |
| `frontend/src/plots/` | Raw, ERP image, ERP, scalp map, r² map, noise curve, drop log |
| `frontend/src/components/` | Side panel with Controls, Guide and Tutor tabs, step bar, tour, shared controls |
| `frontend/src/store/useAppStore.ts` | Shared state: parameters, undo history, time cursor, selected trial |
| `frontend/src/content/` | Guide text, concept cards, experiments, quiz |
| `scripts/` | Sample builders and the robustness sweep |
| `integration/` | FastAPI mount and Streamlit embed examples |

## 5. Data

### 5.1 Bundled samples

The three samples were chosen to be different kinds of experiment. All are stored at 250 Hz in single precision
and are built by `scripts/make_sample_data.py`.

| | Flanker task | Auditory oddball | Flickering light (SSVEP) |
|---|---|---|---|
| Source | ERP CORE, participant 1 (Kappenman et al., 2021) | OpenNeuro ds003061, participant 1, run 1 (Delorme, 2020) | MNE SSVEP example data, participant 2 (Welke & Tavano) |
| Licence | Distributed through MNE-Python | CC0 | CC-BY 4.0 |
| Task | Press a button for a central arrow flanked by matching or opposing arrows | Frequent 500 Hz tones, rare 1000 Hz target tones (keypress), rare noise bursts; eyes closed | A stimulus flickers at 12 or 15 Hz for 20 s at a time |
| Sense and type | Vision, error monitoring | Hearing, rare events | Vision, steady-state rhythm |
| Channels | 30 | 32 (of 64) | 32 |
| Duration | 914 s | 758 s | 467.6 s |
| Events | compatible 200, incompatible 200, correct 346, error 54 | standard 522, target 113, noise 112, keypress 113 | 12 Hz 180, 15 Hz 180 |
| File size | 27.5 MB | 24.3 MB | 15.0 MB |
| Expected effect | ERN at FCz after errors; P3 at Pz | N1 at Cz; P300 at CPz/Pz | Oscillation at the flicker rate over occipital sites |

**Preparation of each sample:**

- *Flanker:* keeps EEG channels and relabels events into stimulus and response types. A response is scored
  correct or an error against the preceding target, and only the first response after each stimulus is scored.
- *Oddball:* keeps a 32-channel subset to reduce file size, applies the BioSemi 64 electrode layout, and merges
  the original labels into `tone/standard`, `tone/oddball`, `sound/noise` and `response/keypress`. Events marked
  "ignore" are dropped.
- *SSVEP:* the app's epochs stop at 2 s, and with only 20 trial onsets the onset response hides the flicker in
  a short window. Each 20 s trial is therefore split into 18 one-second segments, starting one second in to skip
  the onset response. One second holds a whole number of cycles at both 12 and 15 Hz, so the segments stay in
  phase when averaged. An event in this sample is a segment start, not a new stimulus, and the app says so on
  screen. Which marker means which frequency was measured from whole trials rather than assumed: the coherent
  average at Oz had a signal-to-noise ratio of 15.6–17.6 at the correct frequency and 0.4–0.7 at the other.

### 5.2 Uploaded recordings

Uploads are limited to 300 MB. On upload, `io.prepare` does the following and tells the student about each
change on the Load screen:

1. Keeps EEG and stimulus channels; rejects files with no EEG.
2. Keeps only the first 20 minutes of longer recordings.
3. Fills NaN/Inf samples by interpolation and marks those stretches `BAD_missing_data`. Without this, a single
   NaN spreads through the filter to the whole channel and through the average reference to every channel.
4. Applies a standard 10-20 electrode layout if the file has none, first correcting spellings such as
   PhysioNet's `Fcz.` to `FCz`.
5. Finds events from a stimulus channel or from annotations. Annotations marking BAD or EDGE segments are not
   events.
6. Resamples recordings above 300 Hz to 250 Hz.

Two further public recordings for practising upload are built by `scripts/make_upload_examples.py`: a visual
P300 from the Brain Invaders dataset (Cattan et al., 2019) and a PhysioNet motor recording (Schalk et al., 2004).
They are not stored in git.

## 6. Signal-processing methods

The order is the same in the app and in the exported script.

1. **Filter** the EEG channels with MNE's default FIR filter, using the chosen high-pass and low-pass.
2. **Re-reference** to the average of all channels, to one channel, or leave the recording's reference.
3. **Epoch** around the selected events, with baseline correction. Epochs overlapping a BAD segment are not cut.
4. **Reject** any epoch whose peak-to-peak amplitude exceeds the threshold on any EEG channel. Rejected epochs
   are kept in the response so the app can show them greyed out; this gives the same result as
   `mne.Epochs(reject=dict(eeg=...))`.
5. **Average** per condition, with a 95% confidence interval, and compute the difference wave.
6. **Measure** the components below inside the student's chosen window.

| Measure | Definition | Reference |
|---|---|---|
| Peak amplitude and latency | Most positive or negative point in the window | Standard |
| Mean amplitude | Mean voltage in the window; generally more robust than the peak | Standard |
| SME (standardized measurement error) | SD of the per-trial window means (ddof = 1) divided by √N; combined in quadrature for the difference wave | Luck et al., 2021 |
| 50% area latency | Time at which half of the area in the window has accumulated | ERP CORE (Kappenman et al., 2021) |
| Signed r² | r = √(n₁n₂)/(n₁+n₂) × (mean₂ − mean₁)/SD(all trials); reported as sign(r)·r², per channel and time | Blankertz et al., 2011 |
| Noise against N | Measured baseline noise compared with a 1/√N curve | Standard |

The r² map was checked against `scipy.stats.pointbiserialr` in `backend/tests/test_erp.py`.

**Scalp maps** use thin-plate-spline interpolation. The server sends one matrix (grid points × channels) and the
browser multiplies it by the channel values at the chosen time, which keeps scrubbing through time smooth.

**Drop accounting.** Every event ends in exactly one category: kept, rejected by threshold, off the recording's
edge, inside a BAD segment, or a duplicate. These add up to the total and are shown separately. Each rejected
epoch is attributed to the channel with the largest swing.

## 7. Backend API

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Status and which samples are available |
| `POST /api/data/sample` | Load a sample: `{"sample": "flanker" \| "oddball" \| "ssvep"}` (default flanker) |
| `POST /api/data/upload` | Upload one recording and its companion files |
| `GET /api/sessions/{sid}/events` | Event times and codes |
| `POST /api/sessions/{sid}/process` | Epochs, averages, measures, drop summary, r² map |
| `POST /api/sessions/{sid}/raw` | A window of the filtered recording |
| `GET /api/sessions/{sid}/topo` | Scalp-map interpolation matrix |
| `POST /api/sessions/{sid}/export` | Generated script and parameters |
| `GET /api/sessions/{sid}/recording.fif` | The prepared recording |
| `GET /api/tutor/status` | Whether the tutor has a key |
| `POST /api/tutor/chat` | Streamed tutor reply (SSE) |
| `POST /api/tutor/quiz` | Generated quiz questions |
| `POST /api/tutor/grade` | Grade a free-text answer |

**Processing parameters** (`ProcessParams` in `backend/erp_module/schemas.py`):

| Parameter | Range | Default | Notes |
|---|---|---|---|
| `conditions` | 1 to 6 | required | Event code and a unique name |
| `l_freq` | 0–5 Hz | 0.1 | 0 means off |
| `h_freq` | 0–100 Hz | 30 | 0 means off; must be below half the sampling rate |
| `reference` | `average`, `none`, or a channel | `average` | |
| `tmin` / `tmax` | −1–0 s / 0.1–2 s | −0.2 / 0.8 | |
| `baseline` | true/false | true | |
| `baseline_start` / `baseline_end` | −1–0.5 s | −0.2 / 0 | Must lie inside the epoch |
| `reject_uv` | 0–1000 µV | 100 | 0 means off; the slider goes to 300 |
| `channel` | any EEG channel | `Pz` | Falls back to Pz or the first channel if unknown |
| `peak_start` / `peak_end` | −1–2 s | 0.25 / 0.5 | |
| `polarity` | positive / negative | positive | |

**Errors.** Invalid settings return 422 with a message a student can act on. An unreadable upload gets a message
naming the file, without server paths. A BrainVision or EEGLAB upload that lacks a companion file names what is
missing. Uploads over the limit return 413.

**Staying responsive.** A browser abandons its old request whenever a slider moves, but the server cannot see
that. Left alone, abandoned work piled up: in a measured test the plots were still catching up about 35 s after
the last slider move. `Session.latest_only` now runs one request at a time per session and skips any that a
newer request has replaced (HTTP 409), which brought that delay down to about 2 s.

**Memory.** Sessions are kept in memory, at most 8, least recently used first. One shared cache holds up to 4
filtered copies of recordings. Sessions on the same sample share their data.

## 8. Frontend and learning design

### 8.1 The six steps

| Step | What the student does | Plots and output |
|---|---|---|
| 1. Load | Picks one of three experiments or uploads a file | Summary of channels, rate, duration, events |
| 2. Events | Chooses and names conditions; can apply a preset | Event counts and presets |
| 3. Epoching | Sets window, baseline, filters, reference, threshold | Raw signal with epoch boxes, ERP image, drop log, kept/rejected counts |
| 4. ERP | Sets the component window and trials averaged | ERP with confidence bands, difference wave, scalp map, r² map, measurements table, noise curve |
| 5. Learn & Quiz | Reads 6 concept cards, runs 5 guided experiments, takes an 8-question quiz | Progress is saved in the browser |
| 6. Export | Takes the analysis away | Script, recording, JSON, share link, CSV |

The plots take the left of the screen. One panel on the right holds three tabs, **Controls**, **Guide** and
**Tutor**, and shows one at a time, so the plots keep most of the width while a student moves the sliders. The
panel can be resized or collapsed to a slim rail.

Each sample opens with suitable settings through presets in `frontend/src/lib/presets.ts`. A first-visit tour has
three stops. Keyboard shortcuts: `1`–`6` change step, `←`/`→` move the time cursor by 10 ms, and `[` collapses the
side panel.

### 8.2 Controls

| Control | Range offered |
|---|---|
| Epoch window | −1 to 2 s, 0.05 s steps, at least 0.3 s wide |
| Baseline | On/off; window in 0.01 s steps, up to 0.5 s |
| High-pass | Off, 0.1, 0.3, 0.5, 1, 2, 5 Hz |
| Low-pass | 5, 10, 15, 20, 30, 40, 60, 100 Hz or off; only values below half the sampling rate are offered |
| Reference | Average, recording's own, or any channel |
| Rejection threshold | 0 (off) to 300 µV, 5 µV steps |
| Channel | Any EEG channel |
| Component window | Free range, with N1, P300, ERN and Pe shortcuts |
| Polarity | Positive or negative peak |
| Trials averaged | 1 to all kept trials |

### 8.3 Linked views

- Selecting a trial in the ERP image highlights that trial's window in the raw signal.
- Clicking the ERP waveform moves a shared time cursor, and the scalp map follows it.
- Clicking an electrode on the scalp map changes the channel shown.
- Clicking a cell in the r² map sets both channel and time.
- "Pin to compare" keeps the current ERP as a ghost trace while a setting changes.

### 8.4 Teaching feedback

The app explains situations instead of just showing an empty plot. It warns when more than half of the epochs are
rejected, when a high-pass may distort slow components, when a baseline includes the response, and when a
condition has fewer than 20 trials. If no epochs remain, the ERP step says why and links back to Epoching.

### 8.5 Design and accessibility

The interface follows a friendly learning-app style (`design-system/erp-lab/MASTER.md`) with light and dark themes
and self-hosted fonts. Automated axe checks of every step pass at WCAG 2.2 AA in both themes. Controls have
accessible labels and work from the keyboard, and reduced-motion settings are respected.

## 9. AI tutor (optional)

The tutor knows the student's current step, settings and results, and answers about their own numbers. Without
API keys it shows as offline and the rest of the app is unaffected.

| Aspect | Implementation |
|---|---|
| Providers | Gemini (`gemini-2.5-flash`) answers first and sees plot images; Groq (`openai/gpt-oss-120b`) takes over when Gemini is rate-limited or unavailable; either key alone works |
| Modes | Socratic (hints first, on by default) or direct |
| Context sent | Experiment description, step, settings, drop counts, measurements. No raw EEG or per-trial data |
| Plot image | Sent to Gemini only when the student presses "Explain this plot" |
| Tools | `propose_params` (a card with Apply and Undo), `highlight`, `go_to_step`; arguments are validated, and nothing changes without a click |
| Other features | Generated quiz questions and grading of free-text answers |
| Limits | 12 requests per minute per session; last 8 messages of history; 700 tokens per reply, 1500 per quiz; 3 retries; 60 s timeout |

## 10. Export and reproducibility

The Export step produces a standalone MNE-Python script from the current settings. It runs the same calls in the
same order as the app. Three tests run the generated script in a separate process and confirm that it reproduces
the app's ERP within 0.01 µV, across the flanker, oddball and SSVEP samples. Parameters can be saved and restored
as JSON or shared as a link; the link carries parameters only, never data.

## 11. Testing

### 11.1 Automated tests (all passing)

| Suite | Tests | Covers |
|---|---|---|
| `backend/tests/test_robustness.py` | 38 | Damaged and noisy files, parameter extremes |
| `backend/tests/test_samples.py` | 15 | Each sample shows its expected effect; exported script reproduces it |
| `backend/tests/test_erp.py` | 9 | √N noise, peaks, CI, signed r², SME, area latency |
| `backend/tests/test_api.py` | 8 | API end to end, upload, validation |
| `backend/tests/test_tutor.py` | 8 | Routing, offline mode, tool validation, rate limits, quiz schema (LLM mocked) |
| `backend/tests/test_processing.py` | 6 | Baseline, drop counts, rejection rule, filters, reference |
| `backend/tests/test_sessions.py` | 5 | Eviction, shared cache, newest-request-only |
| `backend/tests/test_topo.py` | 3 | Scalp-map interpolation |
| `backend/tests/test_codegen.py` | 1 | Exported script reproduces the app's ERP |
| `backend/tests/test_mount.py` | 1 | Mounting under a sub-path |
| **Backend total** | **94** | |
| Vitest, 6 files in `frontend/src` | 21 | Browser-side ERP maths, filter choices, presets, share links, navigation, SSE parsing |
| Playwright `smoke.spec.ts` | 1 | All six steps through to export |
| Playwright `samples.spec.ts` | 3 | Each sample loads and reaches the ERP step |
| Playwright `a11y.spec.ts` | 2 | axe WCAG 2.2 AA on every step, light and dark |
| **Total** | **121** | |

GitHub Actions (`.github/workflows/ci.yml`) runs three jobs, backend, frontend and e2e, on each push. All three
passed on commit `2c02386`.

### 11.2 Robustness testing

`scripts/robustness/` generates difficult inputs and sweeps parameters through the real API. A call fails if it
crashes, returns non-finite numbers or returns inconsistent results. Clean 4xx answers to invalid settings are
expected.

- **53 generated cases:** every upload format; empty, random, truncated and bit-flipped files; an HTML page named
  `.fif`; missing companion files; no events; NaN and Inf; heavy noise, 50 Hz noise, large drift, spikes, clipping,
  flat or all-zero channels, wrong units; 2048 Hz and 64 Hz recordings; a 28-minute recording; a 310 MB file; one
  or two channels; no electrode positions.
- **8 real recordings on 7 tasks:** flanker, visual P300, auditory oddball, SSVEP, motor execution, motor imagery
  and eyes-open rest, in FIF, EDF, EEGLAB and BrainVision formats, with about 245 parameter combinations each.
- **In the browser:** every control was moved to both ends on 10 recordings, and 5 bad files were confirmed to be
  rejected with a clear message.

After the fixes below, the final runs had no crashes and no inconsistent results.

| Problem found | Fix |
|---|---|
| Raw view returned HTTP 500 for an unknown reference or a low-pass above Nyquist | Clear 422 message |
| Low-pass slider offered impossible values | Only values below half the sampling rate; default adapts |
| NaN samples spread silently and emptied the ERP | Filled, marked BAD, student told |
| Epochs in BAD segments were reported as "too close to edge" | Counted separately, with duplicates |
| Error messages exposed Python internals and server paths | Readable messages naming the file |
| Files with only BAD annotations returned an MNE error | Normal "no events found" message |
| Blank ERP with no explanation when all epochs were rejected | Notice with the reason and a link back |
| Trimming, resampling and renaming happened silently | Listed on the Load screen |
| Slider requests piled up, with plots about 35 s behind | Newest-request-only, about 2 s |
| Docker image had no sample data | `data/` is now copied (not run; see Section 16) |

## 12. Measured results

Measured through the app's own API with each sample's preset. Each sample is one participant, so these results show
that the app works correctly; they are not group findings.

| Preset | Condition | Kept / total | Mean (µV) | SME (µV) | Peak (µV) | Peak latency (ms) | 50% area latency (ms) |
|---|---|---|---|---|---|---|---|
| **ERN** (FCz, 0–100 ms, −) | Correct | 258 / 346 | −1.04 | 0.28 | −2.62 | 52 | 64 |
| | Error | 40 / 54 | −6.88 | 0.83 | −10.35 | 56 | 56 |
| | **Error − correct** | | **−5.84** | 0.88 | **−7.76** | 56 | 52 |
| **P3** (Pz, 300–600 ms, +) | Compatible | 160 / 200 | 3.92 | 0.46 | 7.08 | 396 | 408 |
| | Incompatible | 161 / 200 | 4.52 | 0.41 | 7.38 | 440 | 452 |
| | Difference | | 0.60 | 0.62 | 5.27 | 528 | 520 |
| **P300** (CPz, 250–600 ms, +) | Standard | 497 / 521 | −0.06 | 0.29 | 1.25 | 272 | 284 |
| | Target | 108 / 113 | 7.12 | 0.64 | 11.22 | 412 | 420 |
| | **Target − standard** | | **7.17** | 0.71 | **11.61** | 424 | 428 |
| **Noise** (Cz, 200–450 ms, +) | Standard | 497 / 521 | 0.27 | 0.26 | 2.46 | 200 | 236 |
| | Noise | 108 / 112 | 2.94 | 0.59 | 4.18 | 392 | 332 |
| | Noise − standard | | 2.67 | 0.65 | 4.53 | 356 | 356 |

| Preset | Strongest signed r² cell |
|---|---|
| ERN | FCz, 52 ms, −0.168 |
| P3 | Cz, 536 ms, +0.070 |
| P300 | CPz, 420 ms, +0.218 |
| Noise | FC1, 360 ms, +0.059 |

| SSVEP, 1–40 Hz filter | 12 Hz flicker | 15 Hz flicker |
|---|---|---|
| Epochs kept | 180 / 180 | 180 / 180 |
| Dominant frequency of the average at O2 | 11.8 Hz | 14.9 Hz |
| Peak-to-peak of the average at O2 | 7.7 µV | 6.0 µV |
| Peak-to-peak of the average at Cz | 1.1 µV | 1.1 µV |

**Interpretation**

- *ERN:* a negative deflection within 100 ms of errors at a fronto-central site, as described in the literature.
  The r² map independently finds the same channel and time.
- *P300:* large only for rare target tones and strongest over central-parietal sites near 420 ms; the r² map again
  agrees. An N1 of −2.54 µV appears at Cz at 120 ms for standard tones.
- *Noise bursts:* the response peaks earlier and more centrally (Cz, 356 ms) than the target P300 (CPz, 424 ms), the
  pattern reported for the P3a.
- *SSVEP:* the average follows the flicker rate, and is several times larger over the back of the head. Peak and mean
  amplitude are not meaningful for a sustained rhythm, so students are told to count cycles.
- *Flanker P3:* each condition shows a clear P3, but in this one participant the difference between compatible and
  incompatible (0.60 ± 0.62 µV) is within measurement error. The incompatible peak is 44 ms later (440 vs 396 ms).

## 13. Performance and limits

Measured on the development laptop (16 GB RAM).

| Measure | Result |
|---|---|
| `/process`, new filter settings, flanker sample | 1.61 s |
| `/process`, same filter, new threshold (cached) | 0.71 s |
| Plots catch up after continuous slider movement | About 2 s |
| Server memory after sweeps on all three samples | About 690 MB |
| Frontend build | 5.5 MB in total; Plotly 4.5 MB (loaded lazily), app 593 KB, CSS 79 KB |

| Limit | Value | Where |
|---|---|---|
| Upload size | 300 MB | `backend/erp_module/api.py` |
| Recording length used | First 20 minutes | `backend/erp_module/core/io.py` |
| Resampled if above | 300 Hz, to 250 Hz | `backend/erp_module/core/io.py` |
| Sessions in memory | 8 | `backend/erp_module/sessions.py` |
| Filtered copies cached | 4 | `backend/erp_module/sessions.py` |
| Conditions per analysis | 6 | `backend/erp_module/schemas.py` |
| Epoch length | Up to −1 to 2 s | `backend/erp_module/schemas.py` |

## 14. Running and integrating

```bash
pip install -r requirements.txt
python run.py
```

Then open http://localhost:8000. This needs Python 3.10+ and Node.js 22+. The first run installs the frontend packages
and builds the app. Flags: `--dev` (hot reload, at http://localhost:5173), `--rebuild`, `--host`, `--port`.

Alternative with Docker: `docker compose up --build`.

For the optional tutor, copy `.env.example` to `.env` and add a free `GROQ_API_KEY` and/or `GEMINI_API_KEY`.

To run the tests:

```bash
pytest
```

```bash
cd frontend && npm test
```

```bash
cd frontend && npx playwright test
```

**Merging into the shared course app.** `create_app()` lets a FastAPI hub mount the module under a path after
`npm run build:mounted` (`integration/mount_in_fastapi.py`; covered by `test_mount.py`). A Streamlit hub can embed it
(`integration/streamlit_embed.py`).

## 15. Security and privacy

- API keys stay in `.env` on the server, are ignored by git and are never sent to the browser.
- Uploads are written to a temporary folder that is removed after reading; recordings then exist only in memory.
- The tutor receives summaries only, plus a plot image if the student asks for one to be explained. No raw EEG or
  per-trial data is sent to the LLM providers.
- No login or per-user isolation exists: anyone with a session ID can use that session. This suits a local or
  classroom tool, but public hosting would need authentication and stricter resource limits.
- No CORS middleware is configured, so browsers block cross-origin calls to the API by default.

## 16. Limitations and what has not been verified

| Item | Status |
|---|---|
| Tutor with real keys | Tested on 10 November 2026 with six questions in both modes, plot explanation, quiz and grading. Gemini gave correct written answers every time; Groq's `gpt-oss-120b` sometimes replied with only a suggestion card and twice got the threshold direction wrong, so it is the backup |
| Docker image | **Not run**, because Docker is not available on the development machine |
| Streamlit embed | **Not run** |
| Merge into the shared course repository | **Not done** |
| Each sample is a single participant | The app demonstrates methods, not group-level findings |
| Epochs limited to 3 s in total | SSVEP data had to be split into segments |
| No artefact correction such as ICA | Only rejection is available, so blink-heavy recordings lose many epochs (102 of 400 in the ERN preset) |
| Filters use MNE defaults | Filter type and transition width cannot be changed |
| Sessions are in memory | They are lost on restart and limited to 8, which suits a classroom rather than a public service |
| Peak-based measures on a rhythm | Not meaningful for SSVEP; no frequency-domain plot exists yet |

One backend test and one 310 MB upload failed once while two heavy jobs were competing for memory. Neither failure
recurred when the job was run alone, in repeated runs.

## 17. Future work

1. Add a frequency view for steady-state data (`frontend/src/plots/`, `backend/erp_module/core/erp.py`), so SSVEP can
   be read from its spectrum instead of by counting cycles.
2. Add ICA-based blink correction beside rejection (`backend/erp_module/core/processing.py`), so students can compare
   removing epochs with removing artefacts.
3. Add group-level samples and grand averages (`scripts/make_sample_data.py`).
4. Let students compare filter types (`backend/erp_module/core/processing.py`).
5. Add accounts and persistent sessions for hosted classroom use (`backend/erp_module/sessions.py`).

## 18. Use of AI

Claude Code was used during development for code generation, review, testing and documentation, and all git commits
carry a co-author credit for it. The team has reviewed and tested the code and is responsible for explaining it. The
AI tutor inside the app is a separate, student-facing feature that calls Groq and Gemini.

## 19. References

**Datasets and methods used in the project**

- Blankertz, B., Lemm, S., Treder, M., Haufe, S., & Müller, K.-R. (2011). Single-trial analysis and classification of
  ERP components: A tutorial. *NeuroImage, 56*(2), 814–825.
- Cattan, G., Andreev, A., Rodrigues, P. L. C., & Congedo, M. (2019). Dataset of an EEG-based BCI experiment in Virtual
  Reality and on a Personal Computer. Zenodo. doi:10.5281/zenodo.2605205
- Delorme, A. (2020). EEG data from an auditory oddball task. OpenNeuro ds003061. doi:10.18112/openneuro.ds003061.v1.0.0
- Goldberger, A. L., et al. (2000). PhysioBank, PhysioToolkit, and PhysioNet. *Circulation, 101*(23), e215–e220.
- Gramfort, A., et al. (2013). MEG and EEG data analysis with MNE-Python. *Frontiers in Neuroscience, 7*, 267.
- Kappenman, E. S., Farrens, J. L., Zhang, W., Stewart, A. X., & Luck, S. J. (2021). ERP CORE: An open resource for human
  event-related potential research. *NeuroImage, 225*, 117465.
- Luck, S. J., Stewart, A. X., Simmons, A. M., & Rhemtulla, M. (2021). Standardized measurement error: A universal metric
  of data quality for averaged event-related potentials. *Psychophysiology, 58*(6), e13793.
- Schalk, G., McFarland, D. J., Hinterberger, T., Birbaumer, N., & Wolpaw, J. R. (2004). BCI2000: A general-purpose
  brain-computer interface (BCI) system. *IEEE Transactions on Biomedical Engineering, 51*(6), 1034–1043.
- Welke, D., & Tavano, A. SSVEP example data. OSF. doi:10.17605/OSF.IO/7NE6Y

**Background for interpreting the components**

- Gehring, W. J., Goss, B., Coles, M. G. H., Meyer, D. E., & Donchin, E. (1993). A neural system for error detection and
  compensation. *Psychological Science, 4*(6), 385–390.
- Polich, J. (2007). Updating P300: An integrative theory of P3a and P3b. *Clinical Neurophysiology, 118*(10), 2128–2148.
- Vialatte, F.-B., Maurice, M., Dauwels, J., & Cichocki, A. (2010). Steady-state visually evoked potentials: Focus on
  essential paradigms and future perspectives. *Progress in Neurobiology, 90*(4), 418–438.

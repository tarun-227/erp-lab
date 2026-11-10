# ERP Lab developer guide

## Architecture

```
browser (React + Plotly)  ──HTTP/JSON──▶  FastAPI (backend/erp_module/api.py)
   │  cheap, frequent maths                     │  session store (in memory, LRU)
   │  (averaging for the trials slider,         │
   │   scalp-map matrix multiply, noise curve)  ├─ core/   pure MNE/NumPy functions, no web code
   │                                            └─ tutor/  free LLMs via the OpenAI-compatible API
   └─ SSE stream for tutor answers ◀────────────────┘
```

The backend does the heavy work (loading, filtering, epoching, rejection) and returns compact arrays.
The browser does the work that has to feel instant: `frontend/src/lib/erp.ts` recomputes averages and
confidence intervals for the *Trials averaged* slider, and turns a channel vector into a scalp map with
one multiply by the interpolation matrix from `core/topo.py`.

### Backend (`backend/erp_module/`)

| File | Role |
|---|---|
| `core/io.py` | Reading uploads, keeping EEG + stim, trimming/resampling, finding events (stim channel or annotations) |
| `core/processing.py` | `preprocess` (filter, reference) and `make_epochs` (epochs + peak-to-peak flags + drop summary) |
| `core/erp.py` | Averages with 95% CI, peaks, mean amplitude, residual noise vs N |
| `core/topo.py` | 2D electrode projection and thin-plate-spline interpolation matrix |
| `core/pipeline.py` | Runs epochs → ERPs for one parameter set and packages the JSON for the frontend |
| `core/codegen.py` | Turns parameters into a standalone MNE script |
| `sessions.py` | In-memory sessions, plus one shared, bounded cache of filtered copies (4 at most, ~55 MB each for the sample); sessions on the same recording share copies. `latest_only` runs a session's newest request and skips ones it replaced (HTTP 409), so plots keep up with moving sliders |
| `schemas.py` | Pydantic models; `ProcessParams` validates windows, filters and condition names |
| `api.py` | Routes under `/api`; serves `frontend/dist` at `/` |
| `tutor/` | Provider routing, context builder, prompts, tool definitions and the chat/quiz/grade routes |

Endpoints:

| Method and path | Purpose |
|---|---|
| `POST /api/data/sample` | Load a bundled sample: `{"sample": "flanker" \| "oddball" \| "ssvep"}`, default flanker (each read once, then shared read-only between sessions) |
| `POST /api/data/upload` | Multipart upload (`files`) |
| `GET /api/sessions/{sid}/events` | All event times and codes |
| `POST /api/sessions/{sid}/process` | Epochs + ERPs for a `ProcessParams` body |
| `POST /api/sessions/{sid}/raw` | A decimated window of the processed recording |
| `GET /api/sessions/{sid}/topo` | Electrode layout and interpolation matrix |
| `POST /api/sessions/{sid}/export` | Generated script |
| `GET /api/sessions/{sid}/recording.fif` | The recording as FIF |
| `GET /api/tutor/status`, `POST /api/tutor/chat` (SSE), `/quiz`, `/grade` | AI tutor |

The interactive API docs are at http://localhost:8000/docs while the app runs.

### Frontend (`frontend/src/`)

| Path | Role |
|---|---|
| `store/useAppStore.ts` | Zustand store: step, dataset, parameters (+ undo history), cursor, selected trial, tutor messages |
| `hooks/useProcess.ts` | Debounced TanStack Query call to `/process`; skips invalid parameters (`lib/presets.ts → paramsProblem`) |
| `hooks/useErp.ts` | Client-side condition averages for the trials slider |
| `hooks/useTutor.ts` | Streams tutor answers (SSE), applies and undoes suggested changes |
| `plots/` | One component per plot; `PlotlyChart.tsx` lazy-loads Plotly and registers plots for "Explain this plot" |
| `steps/` | One file per step, each exporting `XxxPanel` (left) and `XxxMain` (centre) |
| `content/` | Explain-panel text, concept cards, experiments and the quiz bank |
| `lib/presets.ts` | Analysis presets per dataset and the default parameters |

Plots link through the store: the ERP image sets `selectedTrial` (the raw plot scrolls to it), the ERP
plot sets `timeCursor` (the scalp map and ERP image follow), the scalp map sets `params.channel`.

## Running in development

```bash
python run.py --dev
```

Backend with auto-reload on :8000, Vite with hot reload on http://localhost:5173 (it proxies `/api`).

## Tests

```bash
pytest
```

```bash
cd frontend && npm test
```

```bash
cd frontend && npx playwright test
```

- `backend/tests/`: run on the bundled ERP CORE sample: processing (baseline, drop counts, the
  peak-to-peak rule, filters, reference), ERP maths (1/√N, peaks, CI), finding the ERN and the P3, topography, the API end to end, the exported script reproducing the app's ERP,
  and the tutor with a mocked LLM client (routing, offline mode, tool validation, rate limits, quiz schema).
- `frontend/src/**/*.test.ts`: client-side ERP maths, share links, step navigation.
- `frontend/e2e/`: a Playwright run through all six steps against the real backend. Locally it uses Edge
  (set `PW_CHANNEL=chrome` for Chrome) and `PYTHON` to pick the interpreter, e.g.
  `PYTHON=../.venv/Scripts/python.exe npx playwright test`.
- `backend/tests/test_samples.py`: each bundled sample must show the effect it is offered for (ERN and P3; N1,
  P300 and the noise response; the flicker frequency over occipital sites), and the exported script must
  reproduce the app's ERP on it. If you change a sample or the pipeline, these tell you the teaching still holds.
- `backend/tests/test_robustness.py`: damaged uploads (empty, random bytes, HTML, truncated, BrainVision
  without its companions), recordings with NaN gaps, BAD segments, extreme noise, drift, spikes, flat or
  zero channels, wrong units, and parameter extremes (filters, windows, thresholds, settings that do not
  fit a slow recording). The app must answer with data or a clear 4xx message, never a 500.

### Robustness sweep (manual, slower)

`scripts/robustness/` stress-tests the whole API with about 50 generated cases (every upload format, damaged
files, noisy and odd recordings, a 28-minute recording, 2048 Hz and 64 Hz data, >300 MB) and with real
recordings, sweeping filters, references, channels, windows, baselines, thresholds and peak windows plus
150 random combinations per recording:

```bash
python scripts/robustness/make_cases.py . cases
python scripts/robustness/sweep_api.py . cases report.jsonl --extra data/examples/p300_cattan2019_s01_raw.fif
python scripts/robustness/summarize.py report.jsonl
```

A call fails the sweep if it raises (HTTP 500 or non-finite numbers) or returns inconsistent results
(trial counts that do not add up, a wrong time axis). Clean 4xx answers are expected for invalid settings.

## Common changes

**Add a quiz question**: append to `QUIZ` in `frontend/src/content/learn.ts` (`question`, four `options`,
`answer_index`, `explanation`).

**Add a "Try this" experiment**: append to `EXPERIMENTS` in the same file. `changes` is a partial
parameter set (or a function of the current parameters); `step` is where the student is taken.

**Add a preset**: add to `PRESETS` in `frontend/src/lib/presets.ts`. A preset only appears
when the dataset has all of its condition names.

**Add a processing parameter**: add it to `ProcessParams` in `backend/erp_module/schemas.py`, use it in
`core/pipeline.py` and `core/codegen.py` (keep the script identical to the app, `test_codegen.py` checks
this), mirror it in `frontend/src/lib/types.ts` and `BASE_PARAMS`, and add a control in the step's panel.

**Change the tutor's models**: set `TUTOR_VISION_MODEL` (Gemini, which answers first) or `TUTOR_TEXT_MODEL` (Groq,
the backup) in `.env`. Groq retires models often; list the current ones with its `/models` endpoint.
Defaults live in `backend/erp_module/tutor/client.py`. Free-tier model names change; if the tutor reports
an unknown model, pick a current one from the provider's model list.

**Rebuild the real sample**: `python scripts/make_sample_data.py` downloads ERP CORE through MNE (~90 MB,
once) and writes `data/sample_erp_raw.fif`.

## Merging into the shared course app

Two routes, depending on how the shared app is built. Both are tested.

1. **Mount the module** (the shared app is FastAPI): build the UI for the prefix, then mount the module's
   ASGI app. The frontend's API calls follow Vite's base path, so nothing else changes.

   ```bash
   cd frontend && npm run build:mounted
   ```

   ```python
   from erp_module.api import create_app
   hub.mount("/modules/erp", create_app(ROOT / "frontend" / "dist-mounted"))
   ```

   `integration/mount_in_fastapi.py` is a runnable example (`python integration/mount_in_fastapi.py`, then
   open http://localhost:8000/modules/erp/), and `backend/tests/test_mount.py` checks the mounted API.
2. **Embed it** (the shared app is Streamlit or anything else): run ERP Lab as its own service
   (`python run.py` or `docker compose up`) and embed it. `integration/streamlit_embed.py` does this with
   `streamlit.components.v1.iframe` (`streamlit run integration/streamlit_embed.py`; set `ERP_LAB_URL` if
   the service is elsewhere).

The processing core (`backend/erp_module/core/`) has no web dependencies, so other modules can import it
directly (for example `from erp_module.core.processing import make_epochs`).

## Design system

The interface follows `design-system/erp-lab/MASTER.md`: a friendly learning-app style (soft, rounded
"clay" controls; flat, precise plots), indigo primary with a warm accent, Nunito headings over DM Sans
body text, light theme first with a matching dark theme. Colour tokens live in `frontend/src/index.css`
(and as hex for Plotly in `frontend/src/lib/colors.ts`); use the tokens, never raw hex, in components.
It was derived with the ui-ux-pro-max skill's data (see the file's header).

`frontend/e2e/a11y.spec.ts` runs axe on every step in both themes and fails on any serious or critical
WCAG 2.2 AA issue, so keep it green when changing the UI.

## Conventions

- Backend: plain functions in `core/`, type hints, docstrings that explain *why*. Every number the frontend
  shows comes from `core/` or `lib/erp.ts`, both covered by tests.
- Frontend: one component per plot, shared state in the store, no server calls outside `lib/api.ts` and
  `hooks/useTutor.ts`.
- Keys and secrets only in `.env`, which git ignores.

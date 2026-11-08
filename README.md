# ERP Lab: Epoching & ERP teaching module

Interactive web module for **CS5109 Brain–Computer Interfaces**, Option A, topic 4 (Epoching and ERP).
Students load EEG, cut it into epochs, average them into event-related potentials, and see how every
processing choice changes the result. An optional AI tutor explains the student's own results.

- **Six guided steps**: Load → Events → Epoching → ERP → Learn & Quiz → Export
- **Data**: a bundled ERP CORE flanker recording (stimulus- and response-locked events, with an ERN after
  errors), or your own `.fif` / `.edf` / `.bdf` / `.set` / BrainVision file
- **Linked, live plots**: raw EEG with epoch windows ↔ ERP image of every trial; ERP waveforms ↔ animated
  scalp map ↔ signed r² channel × time map; drop log; noise vs 1/√N
- **Measurements**: mean amplitude with its SME (data quality), peak latency and amplitude, 50% area latency
- **Parameters**: epoch window, baseline, high-pass, low-pass, reference, rejection threshold, channel,
  peak window and polarity, trials averaged, plus one-click presets with undo
- **Explain panel** for every step, concept cards, "Try this" experiments and a quiz
- **Export**: a standalone MNE-Python script that reproduces the app's ERP exactly, the recording,
  parameters JSON, a share link, and results as CSV/PNG
- **AI tutor** (optional, free): Groq for chat, Gemini for "Explain this plot" images

## Run it

```bash
pip install -r requirements.txt
```

```bash
python run.py
```

Then open http://localhost:8000. The first run installs the frontend packages and builds the app
(needs Node.js 22+). Requires Python 3.10+.

With Docker instead (no Python or Node needed):

```bash
docker compose up --build
```

## AI tutor (optional)

Copy `.env.example` to `.env` and add free keys:

- `GROQ_API_KEY` from https://console.groq.com/keys (chat, quizzes, grading)
- `GEMINI_API_KEY` from https://aistudio.google.com/apikey (lets "Explain this plot" see the plot image)

Restart the app. Without keys the tutor shows as offline and everything else works.
The tutor receives parameters and summary numbers only, never raw EEG.

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

38 backend tests (pytest), 15 frontend unit tests (Vitest), and Playwright end-to-end tests: a run through
all six steps plus an automated accessibility check (axe, WCAG 2.2 AA) of every step in light and dark
themes. See the developer guide for details.

## Documentation

- [User guide](docs/USER_GUIDE.md): what every step, parameter and plot does
- [Developer guide](docs/DEVELOPER_GUIDE.md): architecture, API, tests, how to extend and how to merge
  into the shared course app
- [Design system](design-system/erp-lab/MASTER.md): colours, type, components and accessibility rules
  behind the interface
- [Demo script](docs/DEMO.md): the 10-minute demo and likely viva questions
- [Contribution statement](CONTRIBUTION.md)

## Project layout

| Path | What it holds |
|---|---|
| `backend/erp_module/core/` | Pure EEG processing (MNE-Python, NumPy), no web code |
| `backend/erp_module/tutor/` | AI tutor: provider routing, context, prompts, tools, routes |
| `backend/erp_module/api.py` | FastAPI routes under `/api`; serves the built frontend at `/` |
| `backend/tests/` | pytest suite |
| `frontend/src/` | React + TypeScript app (Vite, Tailwind, shadcn/ui, Plotly, Zustand, TanStack Query) |
| `frontend/e2e/` | Playwright end-to-end test |
| `data/sample_*_raw.fif` | The three bundled samples: flanker, auditory oddball, SSVEP (built by `scripts/make_sample_data.py`) |
| `run.py` | One-line run command |
| `integration/` | Examples for merging into the course app: FastAPI mount and Streamlit embed |

## Data and credits

The three bundled samples:

- **Auditory oddball**: participant 1, run 1, 32 of 64 channels: Delorme, A. (2020). EEG data from an auditory oddball
  task. OpenNeuro ds003061, doi:10.18112/openneuro.ds003061.v1.0.0 (CC0).
- **SSVEP**: participant 2, each trial split into 1 s segments: Welke, D., & Tavano, A. SSVEP example data. OSF,
  doi:10.17605/OSF.IO/7NE6Y (CC-BY 4.0). Distributed through MNE-Python (`mne.datasets.ssvep`).
- **Flanker**: participant 1 of the ERP CORE flanker task: Kappenman, E. S., Farrens, J. L., Zhang, W.,
Stewart, A. X., & Luck, S. J. (2021). ERP CORE: An open resource for human event-related potential
research. *NeuroImage*, 225, 117465. Distributed through MNE-Python (`mne.datasets.erp_core`).

Example uploads (`scripts/make_upload_examples.py`, not committed):
- Brain Invaders P300 on a PC, subject 1 (the file MOABB's `Cattan2019_VR` loads): Cattan, G., Andreev, A.,
  Rodrigues, P. L. C., & Congedo, M. (2019). Dataset of an EEG-based BCI experiment in Virtual Reality and on a
  Personal Computer. Zenodo, doi:10.5281/zenodo.2605205 (CC-BY-4.0).
- PhysioNet EEG Motor Movement/Imagery, subject 1, run 3, via MNE: Schalk, G., McFarland, D. J., Hinterberger, T.,
  Birbaumer, N., & Wolpaw, J. R. (2004). BCI2000: A general-purpose brain-computer interface (BCI) system.
  *IEEE Transactions on Biomedical Engineering*, 51(6), 1034–1043; Goldberger, A. L., et al. (2000).
  PhysioBank, PhysioToolkit, and PhysioNet. *Circulation*, 101(23), e215–e220.

Built with MNE-Python, FastAPI, React, Plotly, Tailwind CSS and shadcn/ui.

## Use of AI

AI assistance (Claude Code) was used while developing this module. The AI tutor inside the app is a
feature for students and uses free Groq and Gemini models.

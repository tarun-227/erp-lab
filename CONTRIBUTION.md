# Contribution statement

CS5109 Brain–Computer Interfaces, Option A, topic 4 (Epoching and ERP). Team: T²A.

The signed copy of this statement is [docs/Contribution.pdf](docs/Contribution.pdf).

| Member | Roll number | Main responsibilities | Key files or features |
|---|---|---|---|
| Tarun Sekar S.D | CS24B2028 | Frontend and interface: the six step screens, the linked plots (raw EEG, ERP image, ERP waveforms, scalp map, signed r² map), interaction design, design system and accessibility | `frontend/src/steps/`, `frontend/src/plots/`, `design-system/` |
| Ajwad Hussain | CS24B2002 | Backend and EEG processing: loading and cleaning recordings, filtering, epoching, artifact rejection, ERP measurements, scalp-map interpolation, API, sessions and the exported MNE script; backend tests | `backend/erp_module/core/`, `backend/erp_module/api.py`, `backend/tests/` |
| Tarun Nixon | CS24B2013 | Teaching content, AI tutor and delivery: explanations, concept cards, experiments and quiz; the tutor; sample datasets; CI, Docker, documentation and demo | `frontend/src/content/`, `backend/erp_module/tutor/`, `scripts/`, `docs/`, `.github/`, `Dockerfile` |

## Use of AI

AI assistance (Claude Code) was used during development for code generation and review; all members
reviewed, tested and can explain the code. The AI tutor inside the app is a student-facing feature that
calls free Groq and Gemini models.

## Sign-off

All three members signed the statement; see [docs/Contribution.pdf](docs/Contribution.pdf).

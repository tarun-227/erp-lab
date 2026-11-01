"""FastAPI app: the module's API under /api, plus the built React app at /."""

from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path

import mne
import numpy as np
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask

from .core import codegen, io, pipeline, topo
from .schemas import LoadResponse, ProcessParams, RawWindowRequest
from .sessions import Session, store
from .tutor.routes import router as tutor_router

ROOT = Path(__file__).resolve().parents[2]
SAMPLE_FILE = Path(os.environ.get("ERP_SAMPLE_FILE", ROOT / "data" / "sample_erp_raw.fif"))
SAMPLE_DESCRIPTION = (
    "ERP CORE Flankers task, participant 1 (Kappenman et al., 2021). Stimulus events: compatible and "
    "incompatible flanker arrays. Response events: correct and error button presses."
)
MAX_UPLOAD_BYTES = 300 * 1024 * 1024

router = APIRouter(prefix="/api")


def _session(sid: str) -> Session:
    try:
        return store.get(sid)
    except KeyError:
        raise HTTPException(404, "This session has expired. Load the data again.") from None


def _load_response(sid: str, session: Session, names: dict[str, str], description: str = "") -> LoadResponse:
    return LoadResponse(
        session_id=sid,
        source=session.source,
        summary=io.summarize(session.raw, session.events),
        suggested_event_names=names,
        description=description,
        has_positions=topo.layout(session.raw.info) is not None,
    )


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "real_sample": SAMPLE_FILE.exists()}


@lru_cache(maxsize=1)
def _sample() -> tuple[mne.io.BaseRaw, np.ndarray, dict[str, str]]:
    # Read once; sessions never modify their raw (processing works on copies), so they can share it.
    return io.prepare(mne.io.read_raw_fif(SAMPLE_FILE, preload=True, verbose=False))


@router.post("/data/sample", response_model=LoadResponse)
def load_sample() -> LoadResponse:
    if not SAMPLE_FILE.exists():
        raise HTTPException(404, "The bundled sample is missing. Run: python scripts/make_sample_data.py")
    raw, events, names = _sample()
    session = Session(raw=raw, events=events, source="sample")
    sid = store.create(session)
    return _load_response(sid, session, names, SAMPLE_DESCRIPTION)


@router.post("/data/upload", response_model=LoadResponse)
def upload(files: list[UploadFile] = File(...)) -> LoadResponse:
    with tempfile.TemporaryDirectory() as tmp:
        paths, total = [], 0
        for f in files:
            path = Path(tmp) / Path(f.filename or "upload").name
            with path.open("wb") as out:
                while chunk := f.file.read(1 << 20):
                    total += len(chunk)
                    if total > MAX_UPLOAD_BYTES:
                        raise HTTPException(413, "The upload is larger than 300 MB.")
                    out.write(chunk)
            paths.append(path)
        try:
            raw, events, names = io.prepare(io.read_upload(paths))
        except ValueError as err:
            raise HTTPException(422, str(err)) from None
        except Exception as err:  # MNE readers raise many different types for malformed files
            raise HTTPException(422, f"Could not read the file: {err}") from None
    session = Session(raw=raw, events=events, source="upload", meta={"filename": paths[0].name})
    sid = store.create(session)
    return _load_response(sid, session, names, f"Uploaded file {paths[0].name}.")


@router.get("/sessions/{sid}/events")
def events(sid: str) -> dict:
    session = _session(sid)
    ev = session.events
    return {
        "times_s": ((ev[:, 0] - session.raw.first_samp) / session.raw.info["sfreq"]).round(4).tolist(),
        "codes": ev[:, 2].tolist(),
    }


@router.post("/sessions/{sid}/process")
def process(sid: str, params: ProcessParams) -> dict:
    session = _session(sid)
    p = params.model_dump()
    try:
        pre = session.preprocessed(params.l_freq, params.h_freq, params.reference)
        result = pipeline.process(pre, session.events, p)
    except ValueError as err:
        raise HTTPException(422, str(err)) from None
    session.meta["last"] = {"params": p, "result": result}
    return result


@router.post("/sessions/{sid}/raw")
def raw_window(sid: str, req: RawWindowRequest) -> dict:
    session = _session(sid)
    pre = session.preprocessed(req.params.l_freq, req.params.h_freq, req.params.reference)
    return pipeline.raw_window(pre, req.start_s, req.duration_s)


@router.get("/sessions/{sid}/topo")
def topography(sid: str) -> dict:
    layout = topo.layout(_session(sid).raw.info)
    if layout is None:
        raise HTTPException(404, "This recording has no electrode positions, so no scalp map can be drawn.")
    return layout


@router.post("/sessions/{sid}/export")
def export(sid: str, params: ProcessParams) -> dict:
    session = _session(sid)
    stim = mne.pick_types(session.raw.info, stim=True, eeg=False)
    script = codegen.make_script(
        params.model_dump(),
        {c.name: c.code for c in params.conditions},
        uses_stim_channel=bool(len(stim)),
        stim_channel=session.raw.ch_names[stim[0]] if len(stim) else "STI",
    )
    return {"script": script, "params": params.model_dump()}


@router.get("/sessions/{sid}/recording.fif")
def recording(sid: str) -> FileResponse:
    session = _session(sid)
    tmp = Path(tempfile.mkdtemp())
    path = tmp / "recording_raw.fif"
    session.raw.save(path, overwrite=True, verbose=False)
    return FileResponse(
        path, filename="recording_raw.fif", media_type="application/octet-stream",
        background=BackgroundTask(lambda: (path.unlink(missing_ok=True), tmp.rmdir())),
    )


def _frontend_dist() -> Path:
    return Path(os.environ.get("ERP_FRONTEND_DIST", ROOT / "frontend" / "dist"))


def create_app(frontend_dist: Path | None = None) -> FastAPI:
    """The whole module as one ASGI app.

    To merge it into a larger FastAPI app, mount it under a prefix with the frontend built for that
    prefix: ``hub.mount("/modules/erp", create_app(ROOT / "frontend" / "dist-mounted"))``
    after ``npm run build:mounted``.
    """
    app = FastAPI(title="ERP Lab", version="1.0.0")
    app.include_router(router)
    app.include_router(tutor_router)
    dist = frontend_dist or _frontend_dist()
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    return app


app = create_app()

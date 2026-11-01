"""Example: serve ERP Lab inside a larger FastAPI course app under /modules/erp.

    cd frontend && npm run build:mounted      # builds the UI for the /modules/erp/ prefix
    python integration/mount_in_fastapi.py    # then open http://localhost:8000/modules/erp/
"""

import os
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from erp_module.api import create_app  # noqa: E402

hub = FastAPI(title="BCI course app")
hub.mount("/modules/erp", create_app(ROOT / "frontend" / "dist-mounted"))


@hub.get("/", response_class=HTMLResponse)
def index() -> str:
    return '<h1>BCI course modules</h1><ul><li><a href="/modules/erp/">Epoching &amp; ERP</a></li></ul>'


if __name__ == "__main__":
    uvicorn.run(hub, port=int(os.environ.get("PORT", 8000)))

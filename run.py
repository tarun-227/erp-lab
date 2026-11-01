"""One-line run for the ERP module.

    python run.py            build the frontend if needed, then serve everything at http://localhost:8000
    python run.py --dev      backend with auto-reload + Vite dev server with hot reload at http://localhost:5173
    python run.py --rebuild  force a fresh frontend build first
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
DIST_INDEX = FRONTEND / "dist" / "index.html"


def npm(*args: str) -> list[str]:
    exe = shutil.which("npm")
    if exe is None:
        sys.exit("npm was not found. Install Node.js 22+ (https://nodejs.org) or use: docker compose up --build")
    return [exe, *args]


def frontend_is_stale() -> bool:
    if not DIST_INDEX.exists():
        return True
    built = DIST_INDEX.stat().st_mtime
    sources = [p for p in (FRONTEND / "src").rglob("*") if p.is_file()]
    sources += [FRONTEND / name for name in ("index.html", "package.json", "vite.config.ts")]
    return any(p.stat().st_mtime > built for p in sources if p.exists())


def ensure_node_modules() -> None:
    if not (FRONTEND / "node_modules").is_dir():
        print("Installing frontend dependencies (first run only)...")
        subprocess.run(npm("ci"), cwd=FRONTEND, check=True)


def build_frontend() -> None:
    ensure_node_modules()
    print("Building the frontend...")
    subprocess.run(npm("run", "build"), cwd=FRONTEND, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dev", action="store_true", help="hot-reload mode for development")
    parser.add_argument("--rebuild", action="store_true", help="force a fresh frontend build")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
    except ImportError:
        pass

    sys.path.insert(0, str(BACKEND))
    import uvicorn

    if args.dev:
        ensure_node_modules()
        vite = subprocess.Popen(npm("run", "dev"), cwd=FRONTEND)
        print("Open http://localhost:5173 (Vite proxies /api to the backend on port", args.port, ")")
        try:
            uvicorn.run("erp_module.api:app", host=args.host, port=args.port, reload=True, reload_dirs=[str(BACKEND)])
        finally:
            vite.terminate()
        return

    if args.rebuild or frontend_is_stale():
        build_frontend()
    print(f"ERP Lab running at http://{'localhost' if args.host == '127.0.0.1' else args.host}:{args.port}")
    uvicorn.run("erp_module.api:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()

from fastapi import FastAPI
from fastapi.testclient import TestClient

from erp_module.api import create_app


def test_module_works_when_mounted_under_a_prefix(tmp_path):
    (tmp_path / "index.html").write_text("<html>erp lab</html>")
    hub = FastAPI()
    hub.mount("/modules/erp", create_app(tmp_path))
    client = TestClient(hub)
    assert client.get("/modules/erp/api/health").json()["status"] == "ok"
    assert client.get("/modules/erp/api/tutor/status").status_code == 200
    assert "erp lab" in client.get("/modules/erp/").text


def test_pages_are_revalidated_but_assets_and_api_are_not(tmp_path):
    from fastapi.testclient import TestClient

    from erp_module.api import create_app

    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)")
    client = TestClient(create_app(tmp_path))
    assert client.get("/").headers.get("cache-control") == "no-cache"
    assert "cache-control" not in client.get("/assets/index-abc123.js").headers
    assert "cache-control" not in client.get("/api/health").headers

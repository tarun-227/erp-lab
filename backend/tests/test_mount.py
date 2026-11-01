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

import sys
from pathlib import Path
import pytest
from starlette.testclient import TestClient

# Ensure root directory is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.main import app


@pytest.fixture(scope="session")
def client():
    """Synchronous test client for FastAPI endpoints."""
    with TestClient(app) as c:
        yield c

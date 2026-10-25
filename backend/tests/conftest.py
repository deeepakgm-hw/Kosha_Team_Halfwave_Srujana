import sys
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

# Ensure root directory is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.db.database import Base, get_db
from backend.app.main import app

# Isolated in-memory SQLite engine for testing
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Provides a fresh isolated database schema and session per test function."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def hermetic_test_environment(monkeypatch):
    """Ensures test suite runs hermetically in test mode without network dependency."""
    from backend.app.core.config import settings
    from backend.app.services.razorpay_service import razorpay_service
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or "kosha_rzp_webhook_secret_2026"
    monkeypatch.setattr(settings, "RAZORPAY_MODE", "test")
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", webhook_secret)
    monkeypatch.setattr(razorpay_service, "mode", "test")
    monkeypatch.setattr(razorpay_service, "key_id", "rzp_test_fixture_key")
    monkeypatch.setattr(razorpay_service, "key_secret", "test_secret_fixture_123")
    monkeypatch.setattr(razorpay_service, "webhook_secret", webhook_secret)


@pytest.fixture(scope="function")
def client(db_session):
    """Test client with isolated database session injected via dependency override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

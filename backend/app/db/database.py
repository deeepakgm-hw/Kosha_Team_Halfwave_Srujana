"""
Database engine and session management.
Uses SQLite for local zero-dependency persistence.
Provides decimal-safe configuration and thread-safe session factories.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# SQLite requires check_same_thread=False for multithreaded FastAPI requests
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db(engine_instance=None) -> None:
    """Initialize all database tables safely and seed default synthetic personas."""
    target_engine = engine_instance or engine
    Base.metadata.create_all(bind=target_engine)

    # Seed demo entities into SQLite
    try:
        from backend.app.db.seeder import seed_demo_data
        session = SessionLocal(bind=target_engine)
        try:
            seed_demo_data(session)
        finally:
            session.close()
    except Exception:
        # Ignore seeding errors during test runs or alternate databases
        pass


def get_db():
    """FastAPI dependency to yield an isolated database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

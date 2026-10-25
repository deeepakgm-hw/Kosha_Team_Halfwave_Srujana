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
    """Initialize all database tables safely without inserting demo transactions."""
    target_engine = engine_instance or engine
    Base.metadata.create_all(bind=target_engine)

    # Safe lightweight SQLite migration for added columns
    with target_engine.connect() as conn:
        for stmt in [
            "ALTER TABLE shops ADD COLUMN status VARCHAR(20) DEFAULT 'active'",
            "ALTER TABLE customer_repayments ADD COLUMN recorded_by VARCHAR(50) DEFAULT 'customer'",
            "ALTER TABLE customer_credit_transactions ADD COLUMN notes TEXT",
            "ALTER TABLE customer_credit_transactions ADD COLUMN line_items_json TEXT",
            "ALTER TABLE customer_credit_transactions ADD COLUMN idempotency_key VARCHAR(100)",
            "ALTER TABLE customer_repayments ADD COLUMN idempotency_key VARCHAR(100)",
            "ALTER TABLE invoice_payments ADD COLUMN idempotency_key VARCHAR(100)",
            "ALTER TABLE bill_payments ADD COLUMN idempotency_key VARCHAR(100)",
            "ALTER TABLE autopay_attempts ADD COLUMN intended_collection_date DATE",
            "ALTER TABLE autopay_attempts ADD COLUMN notification_requirement VARCHAR(30) DEFAULT 'required'",
            "ALTER TABLE autopay_attempts ADD COLUMN notification_status VARCHAR(30) DEFAULT 'pending'",
            "ALTER TABLE autopay_attempts ADD COLUMN notification_reference VARCHAR(100)",
            "ALTER TABLE autopay_attempts ADD COLUMN notification_timestamp TIMESTAMP",
            "ALTER TABLE autopay_attempts ADD COLUMN eligibility_decision VARCHAR(50)",
            "ALTER TABLE autopay_attempts ADD COLUMN deferral_reason TEXT",
            "ALTER TABLE autopay_attempts ADD COLUMN next_retry_at TIMESTAMP",
        ]:
            try:
                from sqlalchemy import text
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass


def get_db():
    """FastAPI dependency to yield an isolated database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

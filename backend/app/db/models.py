"""
SQLAlchemy ORM models for financial persistence.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from backend.app.db.database import Base


class BusinessModel(Base):
    """Business entity model."""

    __tablename__ = "businesses"

    id = Column(String(50), primary_key=True, index=True)
    legal_name = Column(String(200), nullable=False)
    trade_name = Column(String(200), nullable=False)
    industry = Column(String(100), nullable=False)
    msme_category = Column(String(50), nullable=False)
    registration_number = Column(String(100), nullable=True)
    current_cash = Column(Float, default=0.0)
    is_synthetic = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TransactionModel(Base):
    """Historical settled bank transaction."""

    __tablename__ = "transactions"

    id = Column(String(50), primary_key=True, index=True)
    business_id = Column(String(50), index=True, nullable=False)
    date = Column(String(20), nullable=False)
    type = Column(String(10), nullable=False)  # credit or debit
    category = Column(String(50), nullable=False)
    counterparty = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    reference = Column(String(100), nullable=True)
    is_synthetic = Column(Boolean, default=True)

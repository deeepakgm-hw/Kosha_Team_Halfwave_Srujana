from datetime import datetime, timezone
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for system health status endpoint."""

    status: str = Field(..., description="Operational status", examples=["healthy"])
    app_name: str = Field(..., description="Application name", examples=["KOSHA — Predictive Cash-Flow Engine"])
    version: str = Field(..., description="API Version", examples=["0.1.0"])
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    environment: str = Field(..., description="Deployment environment", examples=["development"])

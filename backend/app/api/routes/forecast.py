from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.errors import AppException
from backend.app.db.database import get_db
from backend.app.schemas.cashflow import (
    ForecastRequest,
    ForecastResponse,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
)
from backend.app.services.cashflow_service import cashflow_service

router = APIRouter()


@router.post(
    "/forecast",
    response_model=ForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate 90-Day Cash Forecast",
    description=(
        "Simulates rolling daily cash balances over the specified horizon (default 90 days) "
        "using real persisted enterprise bank balances, receivables, and payables. "
        "Calculates daily opening cash, inflows, committed outflows, and closing cash. "
        "Flags earliest projected shortfall dates, reserve breaches, and data-quality warnings. "
        "All calculations strictly preserve: closing_cash = opening_cash + inflows - outflows."
    ),
)
def generate_forecast(
    request: ForecastRequest = ForecastRequest(),
    db: Session = Depends(get_db),
) -> ForecastResponse:
    """Generate rolling cash forecast from database records or demo mode."""
    try:
        return cashflow_service.generate_forecast(request, db=db)
    except AppException:
        raise
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting engine error: {str(exc)}",
        ) from exc


@router.post(
    "/simulate",
    response_model=ScenarioSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate What-If Cashflow Scenarios",
    description=(
        "Executes a deterministic what-if scenario comparison against a baseline forecast. "
        "Applies buyer receipt delays, top-line sales contraction, and unplanned emergency outflows. "
        "Recalculates daily balances, earliest shortfall date, reserve breaches, and relative risk shift."
    ),
)
def simulate_scenario(
    request: ScenarioSimulationRequest = ScenarioSimulationRequest(),
    db: Session = Depends(get_db),
) -> ScenarioSimulationResponse:
    """Simulate comparative scenario shocks against baseline forecast."""
    try:
        return cashflow_service.simulate_scenario(request, db=db)
    except AppException:
        raise
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scenario engine error: {str(exc)}",
        ) from exc


"""
Forecast Reliability & Historical Backtesting API Route.
Evaluates historical forecast performance across rolling evaluation windows
to provide empirical band coverage, warning lead times, false alarm ratios, and calibration curves.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.domain.backtest import run_historical_backtest
from backend.app.schemas.cashflow import BacktestResponse

router = APIRouter()


@router.get(
    "",
    response_model=BacktestResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Forecast Reliability & Backtest Calibration",
    description=(
        "Retrieves empirical validation metrics and calibration scatter coordinates "
        "replayed over 12 historical evaluation periods against reconciled ledger actuals."
    ),
)
def get_backtest_metrics(
    business_id: str = Query("apex_precision_mfg", description="Business entity ID"),
    evaluation_periods: int = Query(12, ge=4, le=52, description="Number of historical evaluation periods"),
    db: Session = Depends(get_db),
) -> BacktestResponse:
    """Computes empirical forecast reliability metrics and calibration scatter data."""
    results = run_historical_backtest(
        business_id=business_id,
        evaluation_periods=evaluation_periods,
    )
    return BacktestResponse(**results)

from fastapi import APIRouter
from backend.app.api.routes.health import router as health_router

api_router = APIRouter()

# Register active routes
api_router.include_router(health_router, tags=["Health"])

# NOTE: The following routes are reserved for subsequent phases:
# - /api/load/sample (Synthetic persona loader)
# - /api/load/csv (CSV statement parser)
# - /api/state (Current treasury snapshot)
# - /api/forecast (90-day cash projection)
# - /api/simulate (What-if scenario engine)
# - /api/actions/rank (Corrective intervention priority ranking)
# - /api/receivables/law (MSMED 45-day overdue & penal interest)
# - /api/calendar (Cash calendar commitments)
# - /api/backtest (Forecast trust score & error analysis)
# - /api/brief (Plain-English executive brief)
# - /api/export/csv (CSV forecast export)

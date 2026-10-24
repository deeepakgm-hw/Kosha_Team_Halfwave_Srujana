from fastapi import APIRouter
from backend.app.schemas.health import HealthResponse
from backend.app.core.config import settings

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns the current operational status, API version, and environment of the KOSHA backend.",
)
async def get_health() -> HealthResponse:
    """Return application health information."""
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )

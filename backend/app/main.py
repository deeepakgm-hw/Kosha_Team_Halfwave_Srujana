from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.errors import setup_exception_handlers
from backend.app.api.router import api_router
from backend.app.db.database import init_db
import backend.app.db.models  # ensure models are registered with Base metadata


def create_application() -> FastAPI:
    """FastAPI application factory for KOSHA backend."""
    # Ensure database schema is initialized
    init_db()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        description="Predictive Cash-Flow Early Warning System for Small Businesses (Srujana Tech Fest 2026).",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Configure CORS for local development and frontend origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register structured error handlers
    setup_exception_handlers(app)

    # Register API routes under prefix (/api)
    app.include_router(api_router, prefix=settings.API_PREFIX)

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )

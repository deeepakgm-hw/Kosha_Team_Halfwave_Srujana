import asyncio
from contextlib import asynccontextmanager
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.app.core.config import settings
from backend.app.core.errors import setup_exception_handlers
from backend.app.api.router import api_router
from backend.app.db.database import init_db, SessionLocal
import backend.app.db.models  # ensure models are registered with Base metadata

logger = logging.getLogger("kosha.main")
_scheduler_running = False


async def autopay_scheduler_worker():
    """Autonomous background scheduler worker executing periodic AutoPay collection cycles."""
    global _scheduler_running
    from backend.app.services.collection_engine import collection_engine

    collection_engine.is_running = True
    logger.info(f"AutoPay collection scheduler started (interval: {settings.AUTOPAY_COLLECTION_INTERVAL_SECONDS}s).")

    while _scheduler_running:
        try:
            # Run collection cycle in isolated session
            db = SessionLocal()
            try:
                collection_engine.run_collection_cycle(db=db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in background AutoPay collection cycle: {e}")

        # Sleep for configured interval
        try:
            await asyncio.sleep(settings.AUTOPAY_COLLECTION_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            break

    collection_engine.is_running = False
    logger.info("AutoPay collection scheduler stopped.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI starting and stopping background workers."""
    global _scheduler_running
    scheduler_task = None

    # Start background scheduler in development & production
    if settings.AUTOPAY_COLLECTION_ENABLED and settings.ENVIRONMENT != "test":
        _scheduler_running = True
        scheduler_task = asyncio.create_task(autopay_scheduler_worker())

    yield

    _scheduler_running = False
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass


def create_application() -> FastAPI:
    """FastAPI application factory for KOSHA backend."""
    # Ensure database schema is initialized
    init_db()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        description="Predictive Cash-Flow Early Warning & Enterprise MSME Treasury Platform.",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
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

    # Mount frontend static build if it exists (for unified single-container production deployment)
    frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    if frontend_dist.exists() and (frontend_dist / "index.html").exists():
        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Pass through API, documentation, and OpenAPI specification to FastAPI router
            if (
                full_path.startswith("api")
                or full_path.startswith("docs")
                or full_path.startswith("redoc")
                or full_path.startswith("openapi.json")
            ):
                raise HTTPException(status_code=404, detail="API endpoint not found")
            file_path = frontend_dist / full_path
            if file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(frontend_dist / "index.html")

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

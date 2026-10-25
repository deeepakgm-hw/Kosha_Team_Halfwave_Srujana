from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

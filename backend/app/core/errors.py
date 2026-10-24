from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


class AppException(HTTPException):
    """Base application exception with structured error code and details."""

    def __init__(
        self,
        status_code: int,
        message: str,
        code: str = "APPLICATION_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.details = details or {}


class NotFoundException(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(status_code=404, message=message, code="NOT_FOUND", details=details)


class ValidationError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(status_code=422, message=message, code="VALIDATION_ERROR", details=details)


def setup_exception_handlers(app: FastAPI) -> None:
    """Register custom exception handlers for structured error formatting."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.detail,
                    "details": exc.details,
                    "path": request.url.path,
                }
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred.",
                    "details": str(exc) if app.debug else {},
                    "path": request.url.path,
                }
            },
        )

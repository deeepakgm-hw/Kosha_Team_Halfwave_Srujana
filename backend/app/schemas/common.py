from typing import Any, Dict, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    path: Optional[str] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T
    message: Optional[str] = None

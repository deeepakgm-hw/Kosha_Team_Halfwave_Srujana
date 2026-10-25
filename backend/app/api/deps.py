from typing import Optional
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.app.core.errors import AppException
from backend.app.db.database import get_db
from backend.app.db.models import AuthSessionModel, UserModel
from backend.app.services.auth_service import auth_service


def get_token(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    """Extracts bearer token from Authorization header or cookie."""
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1].strip()
    cookie_token = request.cookies.get("kosha_auth_token")
    if cookie_token:
        return cookie_token.strip()
    return None


def get_current_user(
    token: Optional[str] = Depends(get_token),
    db: Session = Depends(get_db),
) -> UserModel:
    """Authoritative backend user authentication check."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    decoded = auth_service.decode_access_token(token)
    if not decoded:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or token invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check session revocation
    session_rec = (
        db.query(AuthSessionModel)
        .filter_by(token=token, is_revoked=False)
        .first()
    )
    if not session_rec:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or expired. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decoded.get("sub")
    user = db.query(UserModel).filter_by(id=user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_optional_user(
    token: Optional[str] = Depends(get_token),
    db: Session = Depends(get_db),
) -> Optional[UserModel]:
    """Retrieves user if authenticated token is present; returns None otherwise."""
    if not token:
        return None
    try:
        decoded = auth_service.decode_access_token(token)
        if not decoded:
            return None
        user_id = decoded.get("sub")
        return db.query(UserModel).filter_by(id=user_id, is_active=True).first()
    except Exception:
        return None


def require_customer(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Enforces Customer role."""
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: This area is only available to Customer accounts.",
        )
    return current_user


def require_business_owner(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Enforces Business Owner role."""
    if current_user.role != "business_owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: This area is only available to Business Owner accounts.",
        )
    return current_user

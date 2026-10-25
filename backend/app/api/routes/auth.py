from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_token
from backend.app.db.database import get_db
from backend.app.db.models import UserModel
from backend.app.schemas.auth import (
    AuthResponse,
    BusinessRegisterRequest,
    CustomerRegisterRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    UserOut,
)
from backend.app.core.config import settings
from backend.app.services.auth_service import auth_service

router = APIRouter()


@router.get(
    "/config",
    summary="Get Public Auth Configuration",
    description="Returns public configuration including Google Client ID for frontend clients.",
)
def get_auth_config():
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID or "",
    }


def set_auth_cookie(response: Response, token: str) -> None:
    """Sets a secure HTTP-only cookie for session persistence across refreshes."""
    response.set_cookie(
        key="kosha_auth_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production HTTPS
        max_age=86400 * 7,  # 7 days
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clears the session cookie."""
    response.delete_cookie(key="kosha_auth_token", path="/")


@router.post(
    "/register/customer",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Customer Account",
    description="Registers an authenticated customer account with isolated credit ledger profile.",
)
def register_customer(
    data: CustomerRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    res, session = auth_service.register_customer(data=data, db=db)
    set_auth_cookie(response, res.token)
    return res


@router.post(
    "/register/business",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Business Owner Account",
    description="Registers an authenticated business owner account with fresh, real business entity.",
)
def register_business(
    data: BusinessRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    res, session = auth_service.register_business(data=data, db=db)
    set_auth_cookie(response, res.token)
    return res


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Authenticate User (Email & Password)",
    description="Verifies credentials, issues authenticated JWT, and establishes authenticated session.",
)
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    res, session = auth_service.authenticate_user(data=data, db=db)
    set_auth_cookie(response, res.token)
    return res


@router.post(
    "/google",
    response_model=AuthResponse,
    summary="Authenticate with Google Identity Services",
    description="Cryptographically verifies Google ID token via Google TokenInfo API and authenticates user.",
)
def login_with_google(
    data: GoogleAuthRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    res, session = auth_service.authenticate_google(data=data, db=db)
    set_auth_cookie(response, res.token)
    return res


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get Current Authenticated User",
    description="Returns authenticated user profile, permissions, and scoped entity IDs.",
)
def get_me(
    current_user: UserModel = Depends(get_current_user),
) -> UserOut:
    return UserOut.model_validate(current_user)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke Session & Logout",
    description="Invalidates current authenticated token and clears session cookies.",
)
def logout(
    response: Response,
    token: str = Depends(get_token),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if token:
        auth_service.logout_session(token, db)
    clear_auth_cookie(response)
    return MessageResponse(success=True, message="Logged out successfully.")


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request Password Reset Link",
    description="Generates a single-use, time-limited token. Always returns generic success to protect user privacy.",
)
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    res = auth_service.forgot_password(email=data.email, db=db)
    return MessageResponse(success=True, message=res["message"])


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset Password with Token",
    description="Updates account password using a valid cryptographic reset token and revokes active sessions.",
)
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    res = auth_service.reset_password(data=data, db=db)
    return MessageResponse(success=True, message=res["message"])

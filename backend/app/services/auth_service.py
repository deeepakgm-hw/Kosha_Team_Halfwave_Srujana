import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import bcrypt
import httpx
import jwt
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.errors import AppException, NotFoundException
from backend.app.db.models import (
    AuthSessionModel,
    BusinessModel,
    CustomerModel,
    PasswordResetTokenModel,
    ShopModel,
    UserModel,
)
from backend.app.schemas.auth import (
    AuthResponse,
    BusinessRegisterRequest,
    CustomerRegisterRequest,
    GoogleAuthRequest,
    LoginRequest,
    ResetPasswordRequest,
    UserOut,
)


class AuthService:
    """Production authentication service for Customers and Business Owners."""

    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        self.google_client_id = settings.GOOGLE_CLIENT_ID

    # -------------------------------------------------------------------------
    # Cryptographic Password Hashing & Verification
    # -------------------------------------------------------------------------

    @staticmethod
    def hash_password(plain_password: str) -> str:
        """Securely hashes password using bcrypt with automatic salt generation."""
        pwd_bytes = plain_password.encode("utf-8")
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verifies plain password against bcrypt hash in constant time."""
        if not plain_password or not hashed_password:
            return False
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8"),
            )
        except Exception:
            return False

    # -------------------------------------------------------------------------
    # JWT Token Issuance & Verification
    # -------------------------------------------------------------------------

    def create_access_token(
        self, user_id: str, role: str, email: str, expires_delta: Optional[timedelta] = None
    ) -> str:
        """Issues an authenticated JWT token with subject, role, and expiration."""
        now = datetime.now(timezone.utc)
        expire = now + (expires_delta or timedelta(minutes=self.expire_minutes))
        payload = {
            "sub": user_id,
            "role": role,
            "email": email,
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
            "jti": uuid.uuid4().hex,
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def decode_access_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Safely decodes and validates a JWT token."""
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except (jwt.PyJWTError, Exception):
            return None

    # -------------------------------------------------------------------------
    # Customer Registration
    # -------------------------------------------------------------------------

    def register_customer(
        self, data: CustomerRegisterRequest, db: Session
    ) -> Tuple[AuthResponse, AuthSessionModel]:
        """Registers a new Customer account with an isolated customer profile."""
        clean_email = data.email.strip().lower()

        # Duplicate account prevention
        existing_user = db.query(UserModel).filter_by(email=clean_email).first()
        if existing_user:
            raise AppException(
                status_code=400,
                message="An account with this email address already exists. Please sign in.",
                code="EMAIL_ALREADY_REGISTERED",
            )

        hashed = self.hash_password(data.password)

        # Link to existing CustomerModel or create isolated fresh customer entity
        cust = db.query(CustomerModel).filter_by(email=clean_email).first()
        if not cust:
            cust = CustomerModel(
                id=f"cust_{uuid.uuid4().hex[:10]}",
                display_name=data.full_name.strip(),
                phone=data.phone.strip() if data.phone else "+91 90000 00000",
                email=clean_email,
            )
            db.add(cust)
            db.flush()

        user = UserModel(
            id=f"usr_{uuid.uuid4().hex[:10]}",
            email=clean_email,
            hashed_password=hashed,
            full_name=data.full_name.strip(),
            role="customer",
            is_active=True,
            email_verified=False,
            customer_id=cust.id,
        )
        db.add(user)
        db.flush()

        # Create session
        token = self.create_access_token(user_id=user.id, role=user.role, email=user.email)
        session = AuthSessionModel(
            id=f"sess_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=self.expire_minutes),
        )
        db.add(session)
        db.commit()
        db.refresh(user)

        user_out = UserOut.model_validate(user)
        return AuthResponse(token=token, user=user_out, message="Customer registration successful."), session

    # -------------------------------------------------------------------------
    # Business Owner Registration
    # -------------------------------------------------------------------------

    def register_business(
        self, data: BusinessRegisterRequest, db: Session
    ) -> Tuple[AuthResponse, AuthSessionModel]:
        """Registers a new Business Owner account with an isolated real business entity."""
        clean_email = data.email.strip().lower()

        # Duplicate account check
        existing_user = db.query(UserModel).filter_by(email=clean_email).first()
        if existing_user:
            raise AppException(
                status_code=400,
                message="An account with this email address already exists. Please sign in.",
                code="EMAIL_ALREADY_REGISTERED",
            )

        hashed = self.hash_password(data.password)

        # Create authentic, clean BusinessModel (is_demo=False)
        biz_id = f"biz_{uuid.uuid4().hex[:10]}"
        business = BusinessModel(
            id=biz_id,
            legal_name=data.business_name.strip(),
            trade_name=data.business_name.strip(),
            industry="Commercial MSME",
            msme_category="Micro",
            currency="INR",
            registration_number=f"REG-{uuid.uuid4().hex[:8].upper()}",
            is_demo=False,
        )
        db.add(business)
        db.flush()

        # Create a linked default merchant shop so business owner can immediately create bills
        shop_code = f"KSH-{uuid.uuid4().hex[:6].upper()}"
        shop = ShopModel(
            id=f"shop_{uuid.uuid4().hex[:10]}",
            shop_name=data.business_name.strip(),
            shop_code=shop_code,
            category="Commercial Store",
            owner_name=data.full_name.strip(),
            phone=None,
            upi_id=f"{data.business_name.lower().replace(' ', '')[:12]}@upi",
            qr_payload=f"kosha://shop/{shop_code}",
            is_verified=True,
            status="active",
        )
        db.add(shop)
        db.flush()

        user = UserModel(
            id=f"usr_{uuid.uuid4().hex[:10]}",
            email=clean_email,
            hashed_password=hashed,
            full_name=data.full_name.strip(),
            role="business_owner",
            is_active=True,
            email_verified=False,
            business_id=biz_id,
        )
        db.add(user)
        db.flush()

        # Create session
        token = self.create_access_token(user_id=user.id, role=user.role, email=user.email)
        session = AuthSessionModel(
            id=f"sess_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=self.expire_minutes),
        )
        db.add(session)
        db.commit()
        db.refresh(user)

        user_out = UserOut.model_validate(user)
        return AuthResponse(token=token, user=user_out, message="Business registration successful."), session

    # -------------------------------------------------------------------------
    # Email / Password Login
    # -------------------------------------------------------------------------

    def authenticate_user(
        self, data: LoginRequest, db: Session
    ) -> Tuple[AuthResponse, AuthSessionModel]:
        """Authenticates user with generic error message to prevent account discovery."""
        clean_email = data.email.strip().lower()
        user = db.query(UserModel).filter_by(email=clean_email).first()

        # Constant-time comparison simulation if user not found to prevent timing attacks
        if not user or not user.hashed_password:
            self.verify_password("dummy_password", "$2b$12$e8Yh.oFw5g4q9hKzGf8v8eX3RzWJ0G2p4Q6S8uV1Y0X2Z4W6U8O2e")
            raise AppException(
                status_code=401,
                message="Invalid email address or password.",
                code="INVALID_CREDENTIALS",
            )

        if not self.verify_password(data.password, user.hashed_password):
            raise AppException(
                status_code=401,
                message="Invalid email address or password.",
                code="INVALID_CREDENTIALS",
            )

        if not user.is_active:
            raise AppException(
                status_code=403,
                message="This account has been deactivated. Please contact support.",
                code="ACCOUNT_INACTIVE",
            )

        # Enforce account type role consistency
        if data.role and data.role != user.role:
            role_label = "Business Owner" if user.role == "business_owner" else "Customer"
            raise AppException(
                status_code=401,
                message=f"This account is registered as a {role_label}. Please switch the account type above.",
                code="ROLE_MISMATCH",
            )

        token = self.create_access_token(user_id=user.id, role=user.role, email=user.email)
        session = AuthSessionModel(
            id=f"sess_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=self.expire_minutes),
        )
        db.add(session)
        db.commit()
        db.refresh(user)

        user_out = UserOut.model_validate(user)
        return AuthResponse(token=token, user=user_out, message="Signed in successfully."), session

    # -------------------------------------------------------------------------
    # Google Identity Services / OAuth Authentication
    # -------------------------------------------------------------------------

    def authenticate_google(
        self, data: GoogleAuthRequest, db: Session
    ) -> Tuple[AuthResponse, AuthSessionModel]:
        """
        Validates Google ID token via Google's authoritative tokeninfo endpoint.
        Never trust client-supplied identity without backend cryptographic verification.
        """
        token_str = (data.credential or "").strip()
        if not token_str:
            raise AppException(
                status_code=400,
                message="Google authentication credential is required.",
                code="MISSING_GOOGLE_CREDENTIAL",
            )

        # Verify ID token using Google API
        try:
            resp = httpx.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={token_str}",
                timeout=6.0,
            )
            if resp.status_code != 200:
                raise AppException(
                    status_code=400,
                    message="Google token verification failed or expired. Please sign in again.",
                    code="INVALID_GOOGLE_TOKEN",
                )
            payload = resp.json()
        except AppException:
            raise
        except Exception as err:
            raise AppException(
                status_code=400,
                message=f"Unable to verify Google token: {str(err)}",
                code="GOOGLE_VERIFICATION_NETWORK_ERROR",
            )

        # Audience check (if client ID is configured)
        if self.google_client_id:
            token_aud = payload.get("aud")
            if token_aud != self.google_client_id:
                raise AppException(
                    status_code=400,
                    message="Google token audience does not match configured application client ID.",
                    code="GOOGLE_AUD_MISMATCH",
                )

        google_sub = payload.get("sub")
        email = (payload.get("email") or "").strip().lower()
        full_name = payload.get("name") or email.split("@")[0]
        email_verified = payload.get("email_verified") in (True, "true")

        if not email or not google_sub:
            raise AppException(
                status_code=400,
                message="Incomplete identity claims received from Google.",
                code="INVALID_GOOGLE_CLAIMS",
            )

        role_intent = data.role if data.role in ("customer", "business_owner") else "customer"

        # Check existing user
        user = db.query(UserModel).filter(
            (UserModel.google_sub == google_sub) | (UserModel.email == email)
        ).first()

        if user:
            # Preserve existing user's role - a customer cannot elevate to business owner via Google login
            if not user.google_sub:
                user.google_sub = google_sub
            if email_verified and not user.email_verified:
                user.email_verified = True
            db.add(user)
        else:
            # Create fresh account with selected role intent
            cust_id = None
            biz_id = None

            if role_intent == "customer":
                cust = db.query(CustomerModel).filter_by(email=email).first()
                if not cust:
                    cust = CustomerModel(
                        id=f"cust_{uuid.uuid4().hex[:10]}",
                        display_name=full_name,
                        phone="+91 90000 00000",
                        email=email,
                    )
                    db.add(cust)
                    db.flush()
                cust_id = cust.id
            else:
                biz = BusinessModel(
                    id=f"biz_{uuid.uuid4().hex[:10]}",
                    legal_name=f"{full_name}'s Business",
                    trade_name=f"{full_name}'s Store",
                    industry="Commercial MSME",
                    is_demo=False,
                )
                db.add(biz)
                db.flush()
                biz_id = biz.id

                shop_code = f"KSH-{uuid.uuid4().hex[:6].upper()}"
                shop = ShopModel(
                    id=f"shop_{uuid.uuid4().hex[:10]}",
                    shop_name=f"{full_name}'s Store",
                    shop_code=shop_code,
                    owner_name=full_name,
                    is_verified=True,
                    status="active",
                )
                db.add(shop)
                db.flush()

            user = UserModel(
                id=f"usr_{uuid.uuid4().hex[:10]}",
                email=email,
                hashed_password=None,
                full_name=full_name,
                role=role_intent,
                is_active=True,
                email_verified=email_verified,
                google_sub=google_sub,
                customer_id=cust_id,
                business_id=biz_id,
            )
            db.add(user)
            db.flush()

        token = self.create_access_token(user_id=user.id, role=user.role, email=user.email)
        session = AuthSessionModel(
            id=f"sess_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=self.expire_minutes),
        )
        db.add(session)
        db.commit()
        db.refresh(user)

        user_out = UserOut.model_validate(user)
        return AuthResponse(token=token, user=user_out, message="Signed in with Google successfully."), session

    # -------------------------------------------------------------------------
    # Password Reset Flow (Forgot & Reset)
    # -------------------------------------------------------------------------

    def forgot_password(self, email: str, db: Session) -> Dict[str, Any]:
        """
        Generates a secure single-use time-limited reset token.
        Always returns generic response to prevent email discovery attacks.
        """
        clean_email = email.strip().lower()
        user = db.query(UserModel).filter_by(email=clean_email).first()

        raw_token = None
        if user and user.is_active:
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            now = datetime.now(timezone.utc)
            reset_record = PasswordResetTokenModel(
                id=f"prt_{uuid.uuid4().hex[:12]}",
                user_id=user.id,
                token_hash=token_hash,
                expires_at=now + timedelta(hours=1),
            )
            db.add(reset_record)
            db.commit()

        # In dev/test environments, expose token in debug logs or payload for testing convenience
        debug_token = raw_token if (settings.DEBUG or settings.ENVIRONMENT == "development") else None

        return {
            "success": True,
            "message": "If an account matches that email address, password reset instructions have been generated.",
            "debug_token": debug_token,
        }

    def reset_password(self, data: ResetPasswordRequest, db: Session) -> Dict[str, Any]:
        """Validates token, updates password, and revokes active sessions."""
        token_hash = hashlib.sha256(data.token.strip().encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc)

        token_rec = (
            db.query(PasswordResetTokenModel)
            .filter_by(token_hash=token_hash)
            .first()
        )

        if not token_rec or token_rec.used_at is not None:
            raise AppException(
                status_code=400,
                message="Password reset link is invalid or has already been used.",
                code="INVALID_RESET_TOKEN",
            )

        exp = token_rec.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if exp < now:
            raise AppException(
                status_code=400,
                message="Password reset link has expired. Please request a new one.",
                code="EXPIRED_RESET_TOKEN",
            )

        user = db.query(UserModel).filter_by(id=token_rec.user_id).first()
        if not user:
            raise NotFoundException("User account not found.")

        user.hashed_password = self.hash_password(data.new_password)
        token_rec.used_at = now

        # Revoke all active sessions for security
        db.query(AuthSessionModel).filter_by(user_id=user.id).update({"is_revoked": True})
        db.commit()

        return {
            "success": True,
            "message": "Your password has been reset successfully. Please sign in with your new password.",
        }

    # -------------------------------------------------------------------------
    # Session Revocation (Logout)
    # -------------------------------------------------------------------------

    def logout_session(self, token_str: str, db: Session) -> None:
        """Revokes authenticated session."""
        if not token_str:
            return
        session = db.query(AuthSessionModel).filter_by(token=token_str).first()
        if session:
            session.is_revoked = True
            db.commit()


auth_service = AuthService()

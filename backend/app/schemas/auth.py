from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re

EMAIL_REGEX = re.compile(r"^[\w\.\+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-\.]+$")


class CustomerRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150, description="Customer full name")
    email: str = Field(..., description="Valid customer email address")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    confirm_password: str = Field(..., description="Confirmation password matching password")
    phone: Optional[str] = Field(None, description="Optional contact phone number")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class BusinessRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150, description="Business owner full name")
    business_name: str = Field(..., min_length=2, max_length=200, description="Company or store trade name")
    email: str = Field(..., description="Business contact email address")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    confirm_password: str = Field(..., description="Confirmation password matching password")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")
    role: Optional[str] = Field(None, description="Account type hint: 'customer' or 'business_owner'")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., description="Google Identity Services ID Token (JWT)")
    role: Optional[str] = Field("customer", description="Registration intent role: 'customer' or 'business_owner'")


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="Account email address")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Single-use password reset token")
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")
    confirm_password: str = Field(..., description="Confirmation password matching new password")

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    customer_id: Optional[str] = None
    business_id: Optional[str] = None
    is_active: bool
    email_verified: bool
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: UserOut
    message: Optional[str] = None


class MessageResponse(BaseModel):
    success: bool
    message: str

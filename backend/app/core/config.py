import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Automatically load .env if present (supports root directory and backend directory)
root_env = Path(__file__).resolve().parents[3] / ".env"
backend_env = Path(__file__).resolve().parents[2] / ".env"
if root_env.exists():
    load_dotenv(dotenv_path=root_env, override=True)
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=True)


class Settings:
    """Application configuration settings loaded from environment variables."""

    APP_NAME: str = os.getenv("APP_NAME", "KOSHA — Predictive Cash-Flow Engine")
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    API_PREFIX: str = "/api"

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        ).split(",")
        if origin.strip()
    ]

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./kosha.db")

    # Razorpay Payment Gateway Configuration
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    RAZORPAY_MODE: str = os.getenv("RAZORPAY_MODE", "live").lower()  # "test" or "live"
    RAZORPAY_UPI_FLOW: str = os.getenv("RAZORPAY_UPI_FLOW", "payment_link")  # "payment_link", "qr_code", or "order"
    RAZORPAY_MERCHANT_NAME: str = os.getenv("RAZORPAY_MERCHANT_NAME", "Halfwave KOSHA Treasury")
    RAZORPAY_UPI_VPA: str = os.getenv("RAZORPAY_UPI_VPA", "halfwave@razorpay")

    # AutoPay Deadline Collection Engine Configuration
    AUTOPAY_COLLECTION_ENABLED: bool = os.getenv("AUTOPAY_COLLECTION_ENABLED", "True").lower() in ("true", "1", "yes")
    AUTOPAY_COLLECTION_INTERVAL_SECONDS: int = int(os.getenv("AUTOPAY_COLLECTION_INTERVAL_SECONDS", "300"))
    PRE_DEBIT_NOTIFICATION_HOURS: int = int(os.getenv("PRE_DEBIT_NOTIFICATION_HOURS", "24"))
    AUTOPAY_MAX_RETRY_ATTEMPTS: int = int(os.getenv("AUTOPAY_MAX_RETRY_ATTEMPTS", "3"))

    # Authentication & JWT Configuration
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "kosha_dev_jwt_secret_key_change_in_production_32b_len")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours

    # Google Identity OAuth Configuration
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")


settings = Settings()

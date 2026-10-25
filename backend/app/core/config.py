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
    RAZORPAY_MODE: str = os.getenv("RAZORPAY_MODE", "test").lower()  # "test" or "live"
    RAZORPAY_UPI_FLOW: str = os.getenv("RAZORPAY_UPI_FLOW", "payment_link")  # "payment_link", "qr_code", or "order"
    RAZORPAY_MERCHANT_NAME: str = os.getenv("RAZORPAY_MERCHANT_NAME", "KOSHA MSME Treasury")
    RAZORPAY_UPI_VPA: str = os.getenv("RAZORPAY_UPI_VPA", "kosha.msme@razorpay")


settings = Settings()

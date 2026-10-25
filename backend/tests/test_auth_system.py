import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.database import get_db, SessionLocal
from backend.app.db.models import UserModel, AuthSessionModel, CustomerModel, BusinessModel, PasswordResetTokenModel
from backend.app.services.auth_service import auth_service


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_customer_registration_success(client, db):
    email = "test.customer.unique@example.com"
    # Ensure clean state
    db.query(UserModel).filter_by(email=email).delete()
    db.commit()

    payload = {
        "full_name": "Test Customer",
        "email": email,
        "password": "StrongPassword123!",
        "confirm_password": "StrongPassword123!",
        "phone": "+91 91234 56789",
    }
    resp = client.post("/api/auth/register/customer", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "customer"
    assert data["user"]["full_name"] == "Test Customer"
    assert data["user"]["customer_id"] is not None

    # Verify password was hashed and never stored in plaintext
    user = db.query(UserModel).filter_by(email=email).first()
    assert user is not None
    assert user.hashed_password != "StrongPassword123!"
    assert auth_service.verify_password("StrongPassword123!", user.hashed_password)


def get_error_message(resp) -> str:
    data = resp.json()
    if "error" in data and isinstance(data["error"], dict):
        return data["error"].get("message", "")
    if "detail" in data:
        return str(data["detail"])
    return data.get("message", "")


def test_customer_registration_duplicate_rejected(client, db):
    email = "test.customer.unique@example.com"
    payload = {
        "full_name": "Another Name",
        "email": email,
        "password": "Password123456",
        "confirm_password": "Password123456",
    }
    resp = client.post("/api/auth/register/customer", json=payload)
    assert resp.status_code == 400
    msg = get_error_message(resp).lower()
    assert "already exists" in msg


def test_business_registration_success(client, db):
    email = "owner.business.unique@example.com"
    db.query(UserModel).filter_by(email=email).delete()
    db.commit()

    payload = {
        "full_name": "Vikram Adani",
        "business_name": "Adani Spares & Machining",
        "email": email,
        "password": "OwnerSecurePass123",
        "confirm_password": "OwnerSecurePass123",
    }
    resp = client.post("/api/auth/register/business", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "business_owner"
    assert data["user"]["business_id"] is not None

    # Verify business entity was created with is_demo = False
    biz = db.query(BusinessModel).filter_by(id=data["user"]["business_id"]).first()
    assert biz is not None
    assert biz.is_demo is False
    assert biz.legal_name == "Adani Spares & Machining"


def test_login_success_and_invalid_credentials(client, db):
    email = "login.test.account@example.com"
    db.query(UserModel).filter_by(email=email).delete()
    db.commit()

    # Register first
    client.post("/api/auth/register/customer", json={
        "full_name": "Login Tester",
        "email": email,
        "password": "MySecretPassword123",
        "confirm_password": "MySecretPassword123",
    })

    # Test 1: Successful login
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": "MySecretPassword123",
        "role": "customer",
    })
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["token"]
    assert token is not None

    # Test 2: Invalid password
    bad_pwd = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword999",
        "role": "customer",
    })
    assert bad_pwd.status_code == 401
    assert "invalid email address or password" in get_error_message(bad_pwd).lower()

    # Test 3: Non-existent email
    no_user = client.post("/api/auth/login", json={
        "email": "completely.nonexistent@example.com",
        "password": "SomePassword123",
    })
    assert no_user.status_code == 401
    assert "invalid email address or password" in get_error_message(no_user).lower()

    # Test 4: Role mismatch
    wrong_role = client.post("/api/auth/login", json={
        "email": email,
        "password": "MySecretPassword123",
        "role": "business_owner",
    })
    assert wrong_role.status_code == 401
    assert "registered as a customer" in get_error_message(wrong_role).lower()


def test_auth_me_endpoint_and_logout(client, db):
    email = "session.test@example.com"
    db.query(UserModel).filter_by(email=email).delete()
    db.commit()

    reg = client.post("/api/auth/register/customer", json={
        "full_name": "Session Tester",
        "email": email,
        "password": "SessionTestPass123",
        "confirm_password": "SessionTestPass123",
    })
    token = reg.json()["token"]

    # 1. Access /api/auth/me with Bearer token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

    # 2. Access /api/auth/me without token -> clear cookies and assert 401
    client.cookies.clear()
    unauth = client.get("/api/auth/me")
    assert unauth.status_code == 401

    # 3. Logout
    logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200

    # 4. Access /api/auth/me after logout -> 401 (session revoked)
    client.cookies.clear()
    after_logout = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert after_logout.status_code == 401


def test_forgot_and_reset_password_flow(client, db):
    email = "reset.test@example.com"
    db.query(UserModel).filter_by(email=email).delete()
    db.commit()

    client.post("/api/auth/register/customer", json={
        "full_name": "Reset Tester",
        "email": email,
        "password": "OldPassword123!",
        "confirm_password": "OldPassword123!",
    })

    # 1. Request reset
    forgot_res = auth_service.forgot_password(email=email, db=db)
    raw_token = forgot_res.get("debug_token")
    assert raw_token is not None

    # 2. Reset password
    reset_resp = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "BrandNewPassword123!",
        "confirm_password": "BrandNewPassword123!",
    })
    assert reset_resp.status_code == 200

    # 3. Old password should fail
    old_login = client.post("/api/auth/login", json={
        "email": email,
        "password": "OldPassword123!",
    })
    assert old_login.status_code == 401

    # 4. New password should succeed
    new_login = client.post("/api/auth/login", json={
        "email": email,
        "password": "BrandNewPassword123!",
    })
    assert new_login.status_code == 200

    # 5. Token cannot be reused (single-use)
    reuse_resp = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "AnotherNewPassword123!",
        "confirm_password": "AnotherNewPassword123!",
    })
    assert reuse_resp.status_code == 400


def test_google_auth_rejects_fake_or_invalid_tokens(client):
    # Invalid Google token should be rejected by authoritative verification
    resp = client.post("/api/auth/google", json={
        "credential": "fake_unverified_token_12345",
        "role": "customer",
    })
    assert resp.status_code == 400
    msg = get_error_message(resp).lower()
    assert "verification failed" in msg or "google" in msg or "invalid" in msg

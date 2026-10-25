# KOSHA — Razorpay UPI Payment Integration Guide

This guide details the production-grade Razorpay UPI payment integration for KOSHA, supporting connected cash-flow forecasting, shopkeeper credit management, and customer dues settlements.

---

## 1. Architectural Principles & Safety Invariants

### Zero Floating-Point Arithmetic
All money amounts on the server and in the database are computed using integer paise:
- ₹1.00 = 100 paise.
- Converted via `round(inr * 100)` and `paise / 100.0`.
- All database ledger columns (`amount_paise`, `excess_credit_paise`) enforce `Integer`.

### Trust & Verification Hierarchy
- **Never trust client callbacks alone:** A bill's outstanding balance is **never** decreased based solely on browser callbacks, client QR scans, screenshots, or customer self-confirmations.
- **Verification sources:** Balances only reduce when:
  1. A signed Razorpay webhook is received and verified with HMAC-SHA256 constant-time comparison (`hmac.compare_digest`).
  2. A verified server payment callback is confirmed against Razorpay's order and signature.
  3. A merchant-documented counter payment is recorded through the authenticated business ledger.

### Financial Balance Invariant
```
Remaining Outstanding (paise) = max(0, total_amount_paise - initial_paid_paise - verified_payments_paise)
```
- If cumulative verified payments exceed remaining outstanding dues (e.g. concurrent customer payments), the balance is clamped to 0, and the surplus is tracked explicitly in `excess_credit_paise`.
- Payment state transitions cleanly between: `unpaid` -> `partially_paid` -> `paid` (with `pending_verification` during in-flight payments).

---

## 2. Environment Configuration

Razorpay Test Mode is enabled by default to prevent accidental live charges.

Create or update `.env` in the root workspace or backend environment:

```env
# =============================================================================
# RAZORPAY UPI PAYMENT GATEWAY CONFIGURATION
# =============================================================================
RAZORPAY_KEY_ID="rzp_test_KOSHA12345678"
RAZORPAY_KEY_SECRET="kosha_razorpay_secret_test_key_abc123"
RAZORPAY_WEBHOOK_SECRET="kosha_webhook_secret_test_key_xyz789"
RAZORPAY_MODE="test"                     # test | live
RAZORPAY_UPI_FLOW="true"                 # true | false
RAZORPAY_MERCHANT_NAME="Apex Precision Works"
RAZORPAY_UPI_VPA="kosha.business@icici"
```

> **Warning:** Never expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in frontend code or Git commits. Frontend only consumes public `RAZORPAY_KEY_ID` and public merchant info via `GET /api/payment-gateway/config`.

---

## 3. Endpoints Reference

### Public / Payment Gateway APIs
- `GET /api/payment-gateway/config`: Returns public Razorpay key ID, mode, currency, and UPI merchant details.
- `POST /api/payment-gateway/requests`: Creates a new payment request and UPI QR payload for a bill.
- `GET /api/payment-gateway/requests/{id}`: Retrieves payment request details and status.
- `POST /api/payment-gateway/requests/{id}/regenerate`: Regenerates an expired payment request without creating duplicate bills.
- `GET /api/payment-gateway/bills/{bill_id}/history`: Returns complete bill breakdown, payment attempts, and verified payment history.
- `POST /api/payment-gateway/verify`: Server-side payment verification for checkout signatures.
- `POST /api/payment-gateway/webhook`: High-security webhook listener verifying HMAC-SHA256 signature against the exact raw request payload.

### Shopkeeper APIs
- `GET /api/shopkeeper/customers`: Customer directory for selecting bill recipients.
- `POST /api/shopkeeper/bills`: Creates a customer bill with total amount, agreed repayment date, initial documented manual payment, and generates a Razorpay payment request.
- `GET /api/shopkeeper/bills`: Lists merchant bills with verified online collections and outstanding balances.

### Customer APIs
- `GET /api/customer/bills`: Returns only the authenticated customer's bills with payment requests and verified histories.
- `GET /api/customer/bills/{bill_id}`: Scoped lookup for customer bill details.

---

## 4. Webhook Setup (Razorpay Dashboard)

1. In Razorpay Dashboard -> Settings -> Webhooks -> Add New Webhook.
2. Webhook URL: `https://your-domain.com/api/payment-gateway/webhook`
3. Secret: Paste the value configured in `RAZORPAY_WEBHOOK_SECRET`.
4. Active Events:
   - `payment.captured`
   - `payment_link.paid`
   - `order.paid`
   - `qr_code.credited`
   - `payment.failed`
5. Idempotency: All webhook event IDs (`x-razorpay-event-id` or payload event ID) are deduplicated in `WebhookEventModel`. Replays are safely ignored without double-crediting balances.

---

## 5. Verification & Testing

- **Backend Integration Tests:**
  ```bash
  python -m pytest backend/tests/test_razorpay_integration.py -v
  ```
- **Complete Backend Test Suite (99 tests):**
  ```bash
  python -m pytest backend/tests
  ```
- **Frontend Test Suite:**
  ```bash
  npm --prefix frontend test -- --run
  ```
- **Production Build:**
  ```bash
  npm --prefix frontend run build
  ```

# KOSHA — Data Integrity, Duplicate Elimination & End-to-End Reliability Audit

**Project:** KOSHA — *“Know your treasury before it runs dry.”*  
**Theme:** Finance (Problem Statement F-03: Predictive Cash-Flow Management for Small Businesses)  
**Date:** October 2026  
**Auditor:** Senior Full-Stack, Database & Financial QA Architecture Team

---

## 1. Existing Data Sources

KOSHA operates across three operational data streams:
1. **Bank Statement Data (Inflows & Outflows):**
   - Ingested via user CSV uploads (supporting standard schemas, Credit/Debit columns, Indian monetary notations, multi-encoding: UTF-8, UTF-8-BOM, Latin-1, CP1252, and auto-detected delimiters `,`, `;`, `\t`).
   - Sourced from synthetic bank export fixtures and real user statement files.
2. **Business Accounts Receivable & Payable (Invoices & Bills):**
   - Customer invoices (credit sales with due dates and Section 43B(h) MSMED eligibility flags).
   - Vendor bills & operational expenses (payroll, factory shed rent, GST, advance tax commitments).
3. **Customer In-Store Credit & Counter Repayments:**
   - In-store QR code merchant identification (`kosha://shop/{shop_code}`).
   - Customer credit commitments with agreed repayment dates and initial downpayments.
   - Counter cash collections recorded by shopkeepers and digital repayments recorded by customers.
   - Provider-neutral payment gateway sandbox orders.

---

## 2. Current Persistence Strategy

- **Database Engine:** SQLite (configured for local zero-dependency persistence via `sqlite:///./kosha.db`).
- **ORM:** SQLAlchemy with strict decimal-safe configuration (`Numeric(15, 2, asdecimal=True)`).
- **Concurrency Setup:** SQLite connection configured with `check_same_thread=False` and isolated session handling via FastAPI dependency injection (`get_db`).
- **Model Normalization:**
  - `businesses` (tenant entity)
  - `bank_accounts` (opening ledger balance, verification state)
  - `import_batches` (file hash, row counts, statement start/end dates, net movement)
  - `bank_transactions` (date, signed amount, description, reference, cryptographic fingerprint)
  - `customer_invoices` & `invoice_payments`
  - `vendor_bills` & `bill_payments`
  - `operating_expenses` (recurring monthly/quarterly obligations)
  - `shops` (merchant metadata, verification status, active status)
  - `customers` (customer profiles)
  - `customer_credit_transactions` & `customer_repayments`
  - `customer_activities` (audit events)

---

## 3. Identified Duplicate-Generation Paths

During our thorough audit of the codebase, we identified the following critical duplicate-generation paths:

### Path A: CSV Bank Statement Duplicate Ingestion
- **Exact File Duplicate:** Handled via SHA-256 file hash checking in `import_batches`. If the identical file is re-uploaded, it correctly raises HTTP 409 `DUPLICATE_FILE_IMPORT`.
- **Duplicate Rows Within the Same File:**
  - *Risk:* If a CSV contains two identical rows with the same reference or fingerprint, the previous code incremented `duplicate_count` but did not differentiate between in-file duplicates vs previously imported duplicates.
- **Previously Imported Rows in a New Statement File:**
  - *Risk:* When rolling monthly statements overlap (e.g. Sept 15–Oct 15 statement uploaded after Sept 1–Sept 30 statement), overlapping transactions must be skipped and reported as `previously_imported_duplicates`.
- **Legitimate Repeated Transactions (False Positives):**
  - *Risk:* Two distinct transactions on the same date with identical amounts and descriptions (e.g., two ₹500 fuel or meal expenses without UTR/cheque reference numbers) produced identical fingerprints (`date|amount|desc|""`). Treating them as duplicates would incorrectly drop legitimate business transactions.
  - *Fix:* Distinguish exact duplicates (matching external reference) from potential duplicates without references, and preserve distinct transactions while surfacing a warning.

### Path B: Customer Credit Transaction Duplication
- **Network Retries & Double Submissions:**
  - *Risk:* If a customer double-clicks "Confirm & Record Credit Purchase" or if a mobile browser retries a timed-out request, two distinct records with different UUID references (`TXN-XXXXXXXX`) could be inserted into `customer_credit_transactions`.
  - *Fix:* Introduce an `idempotency_key` on `POST /api/customer/transactions` with a database unique constraint.

### Path C: Invoice and Bill Payment Duplication
- **Repeated Payment Submissions:**
  - *Risk:* `InvoicePaymentModel` and `BillPaymentModel` lacked idempotency keys and unique reference constraints. A retried payment request could insert two payment rows and reduce the invoice balance twice.
  - *Fix:* Add idempotency keys and prevent double-application of the same payment reference.

### Path D: Payment Gateway Webhook Duplication
- **In-Memory Webhook Tracking:**
  - *Risk:* `PaymentGatewayService` previously tracked `_processed_webhook_ids` in a Python `set()`. Server restart wiped the set, allowing duplicate webhook deliveries to apply the same payment twice.
  - *Fix:* Persist webhook events in a dedicated `webhook_events` database table with a unique constraint on `event_id`.

### Path E: Repayment Reminder Notification Spam
- **Repeated Scheduled Jobs:**
  - *Risk:* Periodic reminder cron tasks or background workers could emit duplicate notifications for the same overdue or due-today transaction on the same day.
  - *Fix:* Implement a persistent `notifications` table with a deterministic unique `notification_key` (e.g., `remind:{txn_id}:{due_date}:{urgency}`).

---

## 4. Existing APIs vs Missing APIs

| Domain | Existing APIs | Missing / Required Enhancements |
|---|---|---|
| **Statements & CSV** | `POST /api/statements/import-csv`<br>`GET /api/transactions` | `GET /api/statements/duplicates/audit` (dry-run review)<br>`POST /api/statements/duplicates/cleanup`<br>Safe handling of empty string date/balance form parameters. |
| **Invoices & Bills** | `POST /api/invoices`<br>`GET /api/invoices`<br>`POST /api/invoices/{id}/payments`<br>`POST /api/bills`<br>`GET /api/bills`<br>`POST /api/bills/{id}/payments` | Idempotency key support on payment endpoints.<br>Reconciliation linking to bank transactions. |
| **Customer Credit** | `POST /api/customer/transactions`<br>`GET /api/customer/dues`<br>`POST /api/customer/transactions/{id}/repay` | Idempotency key on credit creation and repayments.<br>Optimistic concurrency protection against race conditions. |
| **Shopkeeper** | `GET /api/shopkeeper/shop/summary`<br>`GET /api/shopkeeper/shop/transactions`<br>`POST /api/shopkeeper/transactions/{id}/repayments` | Idempotency on counter collections.<br>Real-time recalculation of cash KPIs. |
| **Payment Gateway** | `GET /api/payment-gateway/status`<br>`POST /api/payment-gateway/initiate`<br>`POST /api/payment-gateway/verify`<br>`POST /api/payment-gateway/webhook` | Database-backed payment attempt persistence (`payment_attempts`).<br>Database-backed webhook deduplication (`webhook_events`). |
| **Notifications** | Ephemeral in `ActivityEventModel` | Persistent `notifications` table with unique constraint on `notification_key`.<br>`GET /api/notifications`<br>`POST /api/notifications/{id}/read`. |

---

## 5. Real Integrations vs Simulated Implementations

1. **Bank Statement Import:**
   - **Status:** **REAL**. Genuine file parser and ingestion engine supporting standard CSV, TSV, custom column mappings, multi-encoding, and Decimal math.
2. **Payment Gateway:**
   - **Status:** **SIMULATED (Provider-Neutral Sandbox)**. Transparently labelled as hackathon demonstration mode. Fully implements order creation, mock cryptographic signature verification, and idempotent webhook handling. Ready for live Razorpay/Cashfree credentials.
3. **Notifications:**
   - **Status:** **REAL (In-App)** with persistent database deduplication. External SMS/WhatsApp gateways marked as awaiting provider credentials.
4. **QR Code Generation:**
   - **Status:** **REAL**. Pure vector SVG generated via Python `qrcode` and rasterized via client canvas.
5. **Camera Scanner:**
   - **Status:** **REAL**. Client-side WebRTC `<video>` scanner via `html5-qrcode`.

---

## 6. Database Integrity Risks & Mitigations

| Integrity Risk | Consequence | Mitigation Implemented |
|---|---|---|
| **Floating-Point Drift** | Inexact monetary sums (e.g. 0.1 + 0.2 != 0.3) | Store all money in `Numeric(15, 2, asdecimal=True)` or integer paise. |
| **Concurrent Double Payments** | Two simultaneous payment requests overdraw balance | Wrap payment allocations in database transactions with balance re-checks before commit. |
| **Re-imported Statement Rows** | Artificially inflated bank balance | SHA-256 transaction fingerprints stored in `idx_txn_biz_fingerprint`. |
| **Double Webhook Delivery** | Credit customer and shop balance twice | Dedicated `webhook_events` table with `UNIQUE(event_id)`. |
| **Empty Form Fields 422 Error** | Statement upload fails with `422 Unprocessable Content` when date is omitted | Parse optional form fields safely, converting empty string `""` to `None`. |

---

## 7. Security and Reliability Concerns

1. **Tenant Isolation:** All financial queries must be strictly scoped to `business_id`, `customer_id`, or `shop_id`. No cross-tenant data leakage.
2. **No Sensitive Banking Credentials:** Never collect or store banking passwords, UPI PINs, card numbers, or OTPs.
3. **Timezone Uniformity:** Store all timestamps in UTC (`datetime.now(timezone.utc)`). Interpret Indian statutory deadlines and due dates strictly in `Asia/Kolkata`.

---

## 8. Prioritized Implementation Plan

1. **Step 1:** Expand database models with `PaymentAttemptModel`, `WebhookEventModel`, `NotificationModel`, and idempotency keys on `CreditTransactionModel`, `InvoicePaymentModel`, and `BillPaymentModel`.
2. **Step 2:** Apply database migrations to `kosha.db`.
3. **Step 3:** Fix HTTP 422 bank statement import contract mismatch (handle empty strings for opening balance and opening balance date).
4. **Step 4:** Enhance CSV import engine to distinguish exact file duplicates, previous duplicates, potential review duplicates, and rejected rows.
5. **Step 5:** Add dry-run duplicate audit and cleanup endpoints.
6. **Step 6:** Persist payment orders and webhook events in the database to prevent duplicate payment allocations.
7. **Step 7:** Implement persistent notification service with scheduled deduplication in `Asia/Kolkata` timezone.
8. **Step 8:** Add comprehensive automated backend and frontend tests covering all 20 required scenarios.

# KOSHA — Persistent Data Schema Specification

> **Storage Engine:** SQLite (`kosha.db`) via SQLAlchemy 2.0 ORM  
> **Financial Precision:** `Numeric(15, 2, asdecimal=True)` with Python `Decimal` representation  
> **Multi-Tenant Design:** All financial records are scoped to `business_id` or `customer_id`  
> **Idempotency & Integrity:** Cryptographic SHA-256 batch hashes, transaction fingerprints, and deterministic idempotency keys

---

## 1. Database Entity-Relationship Architecture

```mermaid
erDiagram
    BUSINESS ||--o{ BANK_ACCOUNT : owns
    BUSINESS ||--o{ IMPORT_BATCH : ingests
    BUSINESS ||--o{ BANK_TRANSACTION : settles
    BUSINESS ||--o{ CUSTOMER_INVOICE : issues
    CUSTOMER_INVOICE ||--o{ INVOICE_PAYMENT : receives
    BUSINESS ||--o{ VENDOR_BILL : incurs
    VENDOR_BILL ||--o{ BILL_PAYMENT : settles
    BUSINESS ||--o{ OPERATING_EXPENSE : schedules
    SHOP ||--o{ CREDIT_TRANSACTION : originates
    CUSTOMER ||--o{ CREDIT_TRANSACTION : borrows
    CREDIT_TRANSACTION ||--o{ REPAYMENT : receives
    CUSTOMER ||--o{ PAYMENT_ATTEMPT : initiates
    PAYMENT_ATTEMPT ||--o{ REPAYMENT : settles
    NOTIFICATION ||--o{ CUSTOMER : alerts
    NOTIFICATION ||--o{ SHOP : notifies

    BUSINESS {
        string id PK
        string legal_name
        string trade_name
        string industry
        string msme_category
        string currency
        string registration_number
        boolean is_demo
        datetime created_at
    }

    BANK_ACCOUNT {
        string id PK
        string business_id FK
        string bank_name
        string account_number_mask
        string currency
        decimal opening_balance
        date opening_balance_date
        boolean is_verified
        datetime created_at
    }

    IMPORT_BATCH {
        string id PK
        string business_id FK
        string bank_account_id FK
        string source_filename
        string file_hash
        datetime imported_at
        int total_rows
        int accepted_rows
        int rejected_rows
        int duplicate_rows
        date statement_start_date
        date statement_end_date
        decimal total_credit_amount
        decimal total_debit_amount
        decimal net_movement
        string reconciliation_status
    }

    BANK_TRANSACTION {
        string id PK
        string business_id FK
        string bank_account_id FK
        string import_batch_id FK
        date transaction_date
        string description
        decimal amount
        string transaction_type
        string external_reference
        string fingerprint UK
        boolean is_reconciled
        datetime created_at
    }

    CUSTOMER_INVOICE {
        string id PK
        string business_id FK
        string invoice_number
        string customer_name
        string customer_id
        date issue_date
        date due_date
        date expected_payment_date
        decimal amount
        decimal paid_amount
        string status
        boolean msmed_eligible
        string notes
        string idempotency_key UK
        datetime created_at
    }

    INVOICE_PAYMENT {
        string id PK
        string invoice_id FK
        decimal amount
        date payment_date
        string reference
        string idempotency_key UK
        datetime created_at
    }

    VENDOR_BILL {
        string id PK
        string business_id FK
        string bill_number
        string vendor_name
        date issue_date
        date due_date
        decimal amount
        decimal paid_amount
        string status
        string priority
        string notes
        datetime created_at
    }

    BILL_PAYMENT {
        string id PK
        string bill_id FK
        decimal amount
        date payment_date
        string reference
        string idempotency_key UK
        datetime created_at
    }

    OPERATING_EXPENSE {
        string id PK
        string business_id FK
        string name
        string category
        decimal amount
        string frequency
        int due_day_of_month
        boolean is_active
        datetime created_at
    }

    CUSTOMER {
        string id PK
        string phone UK
        string display_name
        string email
        string avatar_url
        datetime created_at
    }

    SHOP {
        string id PK
        string shop_name
        string shop_code UK
        string category
        string address
        string phone
        string upi_id
        boolean is_verified
        datetime created_at
    }

    CREDIT_TRANSACTION {
        string id PK
        string reference UK
        string customer_id FK
        string shop_id FK
        string description
        decimal purchase_amount
        decimal initial_paid_amount
        decimal outstanding_amount
        date transaction_date
        date agreed_repayment_date
        string status
        string idempotency_key UK
        datetime created_at
    }

    REPAYMENT {
        string id PK
        string transaction_id FK
        decimal amount
        date repayment_date
        string payment_method
        string payment_status
        string recorded_by
        string provider_reference
        string notes
        string idempotency_key UK
        datetime created_at
    }

    PAYMENT_ATTEMPT {
        string id PK
        string idempotency_key UK
        string order_id UK
        string customer_id FK
        string shop_id FK
        string target_id
        string target_type
        decimal amount
        string currency
        string status
        string gateway_provider
        string provider_payment_id
        string signature
        string error_description
        datetime created_at
        datetime updated_at
    }

    WEBHOOK_EVENT {
        string id PK
        string event_id UK
        string provider
        string event_type
        string payload_json
        string status
        datetime received_at
    }

    NOTIFICATION {
        string id PK
        string notification_key UK
        string recipient_type
        string recipient_id
        string channel
        string title
        string message
        string urgency
        boolean is_read
        datetime scheduled_for
        datetime sent_at
        datetime created_at
    }
```

---

## 2. Integrity & Deduplication Rules

1. **Bank Statement CSV Ingestion:**
   - Entire file cryptographic SHA-256 hash evaluated against `import_batches.file_hash`. Re-uploading an identical file returns HTTP `409 Conflict` with `DUPLICATE_FILE_IMPORT`.
   - In-file duplicate rows with external references are filtered into `exact_file_duplicates`.
   - Existing transactions in the database are filtered into `previously_imported_duplicates`.
   - Repeated same-day same-amount transactions without external reference (common in MSME petty cash and tea/fuel expenses) are preserved using occurrence-based discriminator hashes (`potential_duplicates_review`).

2. **Customer & Merchant Ledgers:**
   - Invoices and Bills enforce unique document numbers per business.
   - Payments and Credit Transactions support client-supplied `idempotency_key`s. Duplicate submissions return the identical existing record without double-debiting balances.
   - Overpayment protection is strictly enforced at database service level. Attempting to repay more than the current outstanding amount raises HTTP `422/400 OVERPAYMENT_NOT_ALLOWED`.

3. **Payment Gateways & Webhooks:**
   - Webhook retries are deduped via SQLite unique index on `webhook_events.event_id`.
   - Payment orders are recorded in `payment_attempts` with status transitions (`created` -> `succeeded` / `failed` / `refunded`).

4. **Persistent Notifications & Reminders:**
   - Notifications use deterministic keys formatted as `remind:{type}:{id}:{tx_id}:{date}:{urgency}`.
   - Running reminder evaluation multiple times on the same date produces 0 duplicate notifications.
   - Due dates and urgencies evaluate strictly in `Asia/Kolkata` timezone.

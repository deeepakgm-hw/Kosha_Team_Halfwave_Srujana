# KOSHA — Persistent Data Schema Specification

> **Storage Engine:** SQLite (`kosha.db`) via SQLAlchemy ORM  
> **Financial Precision:** `Numeric(15, 2, asdecimal=True)` with Python `Decimal` representation  
> **Multi-Tenant Design:** All financial records are scoped to `business_id`

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
    }

    IMPORT_BATCH {
        string id PK
        string business_id FK
        string filename
        string file_sha256
        int total_rows
        int accepted_rows
        int duplicate_rows
        int rejected_rows
        string rejected_details_json
        string reconciliation_json
    }

    BANK_TRANSACTION {
        string id PK
        string business_id FK
        string import_batch_id FK
        string bank_account_id FK
        date transaction_date
        string description
        decimal amount
        string transaction_type
        string external_reference
        string fingerprint
        boolean is_reconciled
    }

    CUSTOMER_INVOICE {
        string id PK
        string business_id FK
        string invoice_number
        string customer_name
        date issue_date
        date due_date
        date expected_payment_date
        decimal amount
        decimal paid_amount
        decimal outstanding_amount
        string status
        boolean msmed_eligible
    }

    INVOICE_PAYMENT {
        string id PK
        string invoice_id FK
        date payment_date
        decimal amount
        string reference
        string bank_transaction_id FK
    }

    VENDOR_BILL {
        string id PK
        string business_id FK
        string bill_number
        string vendor_name
        date issue_date
        date due_date
        string category
        decimal amount
        decimal paid_amount
        decimal outstanding_amount
        string status
        string priority
    }

    OPERATING_EXPENSE {
        string id PK
        string business_id FK
        string title
        string category
        decimal amount
        string frequency
        int day_of_month
        boolean is_active
    }
```

---

## 2. Table Specifications & Constraints

### 1. `businesses`
- `id` (VARCHAR(36), PK): UUID4 or persona slug.
- `legal_name` (VARCHAR(255), NOT NULL): Official registered business entity name.
- `trade_name` (VARCHAR(255), NOT NULL): Commercial brand name.
- `industry` (VARCHAR(100), NOT NULL): Industry vertical (e.g. `Automotive Ancillary`).
- `msme_category` (VARCHAR(20), NOT NULL): MSME Act classification (`Micro`, `Small`, `Medium`).
- `currency` (VARCHAR(10), DEFAULT `"INR"`): Functional currency.
- `is_demo` (BOOLEAN, DEFAULT `FALSE`): Strictly isolates synthetic demonstration records from real financial databases.

### 2. `bank_accounts`
- `id` (VARCHAR(36), PK)
- `business_id` (VARCHAR(36), FK -> `businesses.id`, INDEX)
- `bank_name` (VARCHAR(100), NOT NULL)
- `opening_balance` (NUMERIC(15, 2), NOT NULL, DEFAULT 0.00): Base liquid capital.
- `opening_balance_date` (DATE, NOT NULL): The statement date from which the balance is verified.
- `is_verified` (BOOLEAN, DEFAULT `FALSE`): Verified against a physical or exported bank statement.

### 3. `import_batches`
- `id` (VARCHAR(36), PK)
- `business_id` (VARCHAR(36), FK -> `businesses.id`, INDEX)
- `file_sha256` (VARCHAR(64), NOT NULL, INDEX): Cryptographic hash preventing accidental re-upload of identical files.
- `accepted_rows` (INTEGER, NOT NULL)
- `duplicate_rows` (INTEGER, NOT NULL)
- `rejected_rows` (INTEGER, NOT NULL)
- `rejected_details_json` (TEXT): Audit trail of unparseable rows with specific row numbers and error descriptions.
- `reconciliation_json` (TEXT): Summary of credits, debits, and verified net liquidity movement.

### 4. `bank_transactions`
- `id` (VARCHAR(36), PK)
- `business_id` (VARCHAR(36), FK -> `businesses.id`, INDEX)
- `transaction_date` (DATE, NOT NULL, INDEX)
- `description` (TEXT, NOT NULL)
- `amount` (NUMERIC(15, 2), NOT NULL): Unsigned monetary value.
- `transaction_type` (VARCHAR(10), NOT NULL): Either `"credit"` (inflow) or `"debit"` (outflow).
- `external_reference` (VARCHAR(100), NULLABLE): Bank UTR, cheque number, or gateway ID.
- `fingerprint` (VARCHAR(64), NOT NULL, INDEX): Hash of `(date, amount, type, description, external_ref)` preventing duplicate row insertion across batches.

### 5. `customer_invoices` & `invoice_payments`
- `customer_invoices.outstanding_amount = amount - paid_amount`
- Status transitions:
  - `unpaid`: `paid_amount == 0`
  - `partially_paid`: `0 < paid_amount < amount`
  - `paid`: `paid_amount == amount`
- **Validation Invariant:** A payment cannot exceed `outstanding_amount`. Attempted overpayments raise `ValidationError`.

### 6. `operating_expenses`
- Represents recurring contractual commitments (rent, payroll, utility contracts, statutory advance tax).
- `frequency`: `"monthly"`, `"quarterly"`, or `"annual"`.
- `day_of_month`: Specified payment anchor (e.g. 7th for TDS, 20th for GSTR-3B, 1st for factory rent).
- The 90-day simulator projects these dates across the forward horizon dynamically.

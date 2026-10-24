# KOSHA — API Specification

> **Base URL:** `/api`  
> **Protocol:** HTTP/1.1 REST with JSON payloads & Multipart Form Data (Statements)  
> **Backend Engine:** FastAPI + SQLAlchemy + SQLite (Decimal-safe financial arithmetic)

---

## Implemented Endpoint Matrix

| Method | Endpoint | Responsibility |
|---|---|---|
| `GET` | `/api/health` | Application health, uptime, version, and environment status |
| `POST` | `/api/businesses` | Register a new MSME business profile |
| `GET` | `/api/businesses` | List registered businesses |
| `GET` | `/api/businesses/{id}` | Retrieve business profile by ID |
| `GET` | `/api/businesses/{id}/state` | Reconciled treasury balance, uncollected receivables, open payables, and data quality warnings |
| `POST` | `/api/businesses/{id}/accounts` | Register bank account with verified/unverified opening balance |
| `GET` | `/api/businesses/{id}/accounts` | List accounts associated with a business |
| `POST` | `/api/statements/import-csv` | Multipart CSV statement upload with auto-delimiter sniffing, deduplication, and atomic commit |
| `GET` | `/api/statements/duplicates/audit` | Audit database for duplicate transactions, file hashes, and repeated rows |
| `POST` | `/api/statements/duplicates/cleanup` | Idempotent cleanup of redundant duplicates with dry-run support |
| `GET` | `/api/transactions` | Query persisted bank transactions filtered by business, account, and date range |
| `POST` | `/api/invoices` | Create customer invoice with MSMED 45-day tracking eligibility |
| `GET` | `/api/invoices` | List customer invoices filtered by status (`unpaid`, `partially_paid`, `paid`, `cancelled`) |
| `POST` | `/api/invoices/{id}/payments` | Record customer payment (supports `idempotency_key`, validates overpayment prevention) |
| `POST` | `/api/bills` | Create vendor bill with priority weighting (`critical`, `normal`, `flexible`) |
| `GET` | `/api/bills` | List vendor bills filtered by status |
| `POST` | `/api/bills/{id}/payments` | Record vendor bill outflow (supports `idempotency_key`) |
| `POST` | `/api/operating-expenses` | Register recurring expense (payroll, rent, statutory tax, utilities) |
| `GET` | `/api/operating-expenses` | List recurring operating expenses |
| `POST` | `/api/forecast` | Run deterministic 90-day rolling simulation with reserve breach & shortfall detection |
| `POST` | `/api/simulate` | Run comparative what-if scenario simulation with buyer delays, sales drops, and surprise expenses |
| `POST` | `/api/actions/rank` | Rank corrective interventions using Multi-Criteria Decision Analysis (MCDA) |
| `GET` | `/api/receivables/law` | MSMED Section 16 monthly compound penal interest & Section 43B(h) compliance |
| `GET` | `/api/calendar` | 42-day categorized disbursements (Statutory, Payroll, Loans, Suppliers, Recurring) |
| `GET` | `/api/backtest` | Empirical backtest replay metrics and calibration coordinates |
| `GET` | `/api/customer/dashboard` | Customer profile summary, active dues, upcoming repayment commitments |
| `GET` | `/api/customer/dues` | Filtered customer transactions (`upcoming`, `due_today`, `overdue`, `paid`) |
| `POST` | `/api/customer/credit-transactions` | Record shop purchase on credit with down-payment (supports `idempotency_key`) |
| `POST` | `/api/customer/repayments` | Record customer repayment towards outstanding credit (supports `idempotency_key`) |
| `GET` | `/api/shops` | List participating verified merchant shops |
| `GET` | `/api/shops/{shop_code}` | Resolve shop by code or QR payload |
| `GET` | `/api/shops/{shop_code}/qr` | Generate authoritative SVG QR code and customer payment instructions |
| `GET` | `/api/shopkeeper/shop/summary` | Shopkeeper receivables summary KPIs, overdue balance, today's collections |
| `GET` | `/api/shopkeeper/shop/transactions` | Shopkeeper customer credit transactions with status and search filters |
| `POST` | `/api/shopkeeper/shop/transactions/{id}/repay` | Record direct counter payment collected from customer |
| `GET` | `/api/payment-gateway/status` | Connectivity status and transparent sandbox mode indicator |
| `POST` | `/api/payment-gateway/initiate` | Initiate payment order with persistent idempotency |
| `POST` | `/api/payment-gateway/verify` | Server-side payment verification and idempotent ledger update |
| `POST` | `/api/payment-gateway/webhook` | Idempotent webhook handler with unique event tracking |
| `POST` | `/api/notifications/evaluate` | Evaluate repayment dates in `Asia/Kolkata` and schedule deduplicated reminders |
| `GET` | `/api/notifications` | List persistent notifications for customer or merchant |
| `POST` | `/api/notifications/{id}/read` | Mark persistent notification as read |

---

## 1. Core Endpoints & Contracts

### `GET /api/health`
Returns system status, service version, server timestamp, and environment.

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "app_name": "KOSHA — Predictive Cash-Flow Engine",
  "version": "0.1.0",
  "timestamp": "2026-10-24T12:00:00.000000Z",
  "environment": "development"
}
```

---

### `POST /api/businesses`
Registers a business profile.

#### Request Body
```json
{
  "legal_name": "Apex Precision Components Pvt Ltd",
  "trade_name": "Apex Precision",
  "industry": "Automotive Ancillary",
  "msme_category": "Small",
  "currency": "INR",
  "registration_number": "UDYAM-MH-01-0084920",
  "is_demo": false
}
```

#### Response (`201 Created`)
```json
{
  "id": "e4f8b2d1-9a7c-4e1b-b2f5-3c1a8d0e7f9a",
  "legal_name": "Apex Precision Components Pvt Ltd",
  "trade_name": "Apex Precision",
  "industry": "Automotive Ancillary",
  "msme_category": "Small",
  "currency": "INR",
  "registration_number": "UDYAM-MH-01-0084920",
  "is_demo": false,
  "created_at": "2026-10-24T12:00:00"
}
```

---

### `GET /api/businesses/{id}/state`
Returns the reconciled treasury balance, uncollected receivables, committed bills, and data quality warnings.

#### Response (`200 OK`)
```json
{
  "business_id": "e4f8b2d1-9a7c-4e1b-b2f5-3c1a8d0e7f9a",
  "legal_name": "Apex Precision Components Pvt Ltd",
  "currency": "INR",
  "is_demo": false,
  "current_cash": 450000.00,
  "verified_opening_balance": 450000.00,
  "total_settled_inflows": 125000.00,
  "total_settled_outflows": 75000.00,
  "total_unpaid_receivables": 320000.00,
  "total_unpaid_payables": 180000.00,
  "active_invoices_count": 3,
  "active_bills_count": 2,
  "imported_transactions_count": 42,
  "reconciliation_status": "verified",
  "data_quality_warnings": []
}
```

---

### `POST /api/statements/import-csv`
Uploads a bank statement CSV and commits valid transactions atomically.

#### Request Form Data (`multipart/form-data`)
- `business_id` (string, required): Target business ID
- `file` (binary, required): Statement CSV file
- `bank_account_id` (string, optional): Associated bank account
- `amount_sign_mode` (string, optional, default `"standard"`): `"standard"` (positive = credit/inflow) or `"inverted"`
- `column_mapping_json` (string, optional): JSON string mapping custom headers

#### Canonical CSV Headers Supported:
`transaction_date, description, amount, external_reference` (or separate `credit` and `debit` columns).

#### Response (`200 OK`)
```json
{
  "batch_id": "7a3b4c5d-8e9f-4012-b345-6789abcdef01",
  "business_id": "e4f8b2d1-9a7c-4e1b-b2f5-3c1a8d0e7f9a",
  "filename": "axis_statement_oct2026.csv",
  "total_rows": 15,
  "accepted_rows": 14,
  "duplicate_rows": 0,
  "rejected_rows": 1,
  "rejected_details": [
    {
      "row_number": 8,
      "raw_content": "2026-10-15,Bad Row,INVALID_NUMBER,REF-99",
      "error": "Invalid monetary amount 'INVALID_NUMBER'"
    }
  ],
  "statement_period": {
    "start_date": "2026-10-01",
    "end_date": "2026-10-24"
  },
  "reconciliation": {
    "opening_balance": 450000.00,
    "opening_balance_verified": true,
    "total_credits": 250000.00,
    "total_debits": 140000.00,
    "net_movement": 110000.00,
    "calculated_closing_balance": 560000.00,
    "verification_notes": "Reconciliation verified against opening statement balance."
  }
}
```

---

### `POST /api/invoices` & `POST /api/invoices/{id}/payments`
Create customer invoices and record settlements.

#### Request `POST /api/invoices`
```json
{
  "business_id": "e4f8b2d1-9a7c-4e1b-b2f5-3c1a8d0e7f9a",
  "invoice_number": "INV-2026-105",
  "customer_name": "Tier-1 Auto Assemblers Ltd",
  "amount": 320000.00,
  "issue_date": "2026-10-01",
  "due_date": "2026-10-15",
  "expected_payment_date": "2026-11-05",
  "msmed_eligible": true
}
```

#### Request `POST /api/invoices/{id}/payments`
```json
{
  "payment_date": "2026-11-05",
  "amount": 100000.00,
  "reference": "UTR-AXIS-20261105-01"
}
```
*Validation:* Recording a payment greater than `outstanding_amount` immediately raises HTTP `422 Unprocessable Entity` ("Payment amount exceeds outstanding invoice balance").

---

### `POST /api/forecast`
Runs the rolling daily cash-flow simulation over the specified horizon (default 90 days).
Reconciles opening balance, actual/expected inflows, committed contractual outflows, and closing balance.
Guarantees cash conservation: `closing_balance = opening_balance + inflows - outflows`.
Detects first projected shortfall date, reserve breaches, and counts days in deficit.

#### Request Body
```json
{
  "business_id": "e4f8b2d1-9a7c-4e1b-b2f5-3c1a8d0e7f9a",
  "start_date": "2026-11-01",
  "horizon_days": 90,
  "minimum_reserve": 50000.00,
  "use_sample_data": false
}
```

#### Response (`200 OK`)
```json
{
  "business_id": "e4f8b2d1-9a7c-4e1b-b2f5-3c1a8d0e7f9a",
  "forecast_generated_at": "2026-10-24T12:00:00Z",
  "start_date": "2026-11-01",
  "horizon_days": 90,
  "starting_cash": 450000.00,
  "closing_cash": 125000.00,
  "total_inflows": 320000.00,
  "total_outflows": 645000.00,
  "net_change": -325000.00,
  "minimum_projected_balance": 35000.00,
  "minimum_reserve": 50000.00,
  "first_projected_shortfall_date": null,
  "first_reserve_breach_date": "2026-11-25",
  "negative_cash_days_count": 0,
  "days_below_reserve_count": 12,
  "runway_days": null,
  "is_probabilistic": false,
  "is_synthetic": false,
  "data_quality_warnings": [],
  "assumptions_used": [
    "Unpaid customer invoices projected on expected payment dates or due dates",
    "Committed vendor bills projected on contractual due dates",
    "Monthly recurring operating expenses expanded over 90-day horizon"
  ],
  "daily_projections": [
    {
      "date": "2026-11-01",
      "starting_cash": 450000.00,
      "expected_inflow": 0.00,
      "committed_outflow": 0.00,
      "net_cash_flow": 0.00,
      "ending_cash": 450000.00,
      "is_shortfall": false,
      "shortfall_amount": 0.00,
      "is_reserve_breach": false,
      "reserve_deficit": 0.00,
      "confidence_lower": null,
      "confidence_upper": null,
      "is_synthetic": false
    }
  ]
}
```

---

### `POST /api/simulate`
Executes a comparative what-if scenario comparison against a baseline forecast. Applies buyer receipt delays, top-line sales contractions, and unplanned emergency outflows.

#### Request Body
```json
{
  "business_id": "apex_precision_mfg",
  "persona_id": "manufacturer",
  "use_sample_data": true,
  "horizon_days": 90,
  "minimum_reserve": 100000.0,
  "buyer_delay_days": 20,
  "sales_drop_percent": 15.0,
  "surprise_expense": 150000.0,
  "surprise_expense_day": 15
}
```

#### Response (`200 OK`)
```json
{
  "baseline": { ... },
  "scenario": { ... },
  "risk_comparison": {
    "baseline_risk_pct": 47,
    "scenario_risk_pct": 72,
    "risk_delta_pct": 25,
    "baseline_first_breach_date": "2026-12-09",
    "scenario_first_breach_date": "2026-11-24",
    "baseline_first_shortfall_date": null,
    "scenario_first_shortfall_date": "2026-11-30",
    "baseline_min_balance": 157000.0,
    "scenario_min_balance": -38000.0,
    "minimum_balance_change": -195000.0,
    "baseline_runway_days": 90,
    "scenario_runway_days": 37
  },
  "shocks_applied": {
    "buyer_delay_days": 20,
    "sales_drop_percent": 15.0,
    "surprise_expense": 150000.0,
    "surprise_expense_day": 15
  }
}
```

---

### `POST /api/actions/rank`
Ranks corrective actions (early payment discount, supplier extension, collections chase, expense deferral) tailored to active business shortfall magnitude and timing using Multi-Criteria Decision Analysis (MCDA).

#### Request Body
```json
{
  "business_id": "apex_precision_mfg",
  "shortfall_amount": 65000.0,
  "days_until_shortfall": 18,
  "baseline_risk_pct": 71
}
```

#### Response (`200 OK`)
```json
{
  "business_id": "apex_precision_mfg",
  "shortfall_amount": 65000.0,
  "days_until_shortfall": 18,
  "actions": [
    {
      "id": "act-1",
      "badge": "#1 Recommended",
      "category": "discount",
      "category_label": "Offer early-payment discount",
      "title": "Offer a 2% early-payment discount on Invoice #112",
      "why_recommended": "Achieves the fastest liquidity acceleration (+₹1,37,200 in 3 days) with low counterparty friction and minimal financial cost (₹2,800).",
      "cash_flow_impact": "+₹1,37,200 liquidity accelerated by 18 days",
      "risk_shift": "Risk 71% → 34%",
      "cost": "₹2,800 discount cost",
      "cost_inr": 2800.0,
      "yield_inr": 137200.0,
      "days_to_cash": 3,
      "relationship_cost": "Low",
      "relationship_notes": "Positive commercial incentive that builds buyer goodwill through win-win prompt settlement.",
      "assumptions": "Bharat Auto Parts accounts payable processes prompt payment within 48-72 hours of incentive credit note.",
      "practical_steps": [
        "Issue revised early settlement credit note of 2% (₹2,800) on Invoice #112 to Bharat Auto Parts Accounts Payable.",
        "Request direct NEFT/RTGS bank remittance confirmation within 3 business days.",
        "Reconcile settled invoice in Kosha ledger to clear the projected shortfall zone."
      ],
      "mcda_score": 1.33
    }
  ]
}
```

---

### `GET /api/receivables/law`
Returns customer invoices with statutory penal interest calculated under Section 16 of the MSMED Act, 2006 (compound interest with monthly rests at 3x RBI Bank Rate = 19.50% p.a.), Income Tax Section 43B(h) buyer deduction disallowance status, and formal reminder drafts.

#### Query Parameters
- `business_id` (string): Business entity ID (default: `"apex_precision_mfg"`)
- `rbi_bank_rate` (float): Prevailing RBI Bank Rate (default: `0.065`)

#### Response (`200 OK`)
```json
{
  "business_id": "apex_precision_mfg",
  "rbi_bank_rate_pct": 6.5,
  "msmed_penal_rate_pct": 19.5,
  "compounding_frequency": "Monthly rests (Section 16 MSMED Act)",
  "total_overdue_principal": 180000.0,
  "total_accrued_penal_interest": 4303.99,
  "invoices": [
    {
      "id": "inv_112",
      "invoice_number": "#112",
      "customer_name": "Bharat Auto Parts",
      "amount": 140000.0,
      "due_date": "2026-09-16",
      "overdue_days": 38,
      "is_violation": true,
      "penal_rate_annual": "19.5% p.a. (3x RBI Bank Rate)",
      "accrued_penal_interest": 2883.08,
      "total_claimable": 142883.08,
      "section_43b_status": "PENDING_DISALLOWANCE",
      "section_43b_notes": "Overdue by 38 days past contractual due date. Exceeding 45 days will trigger income tax disallowance for the buyer under Section 43B(h).",
      "statutory_reminder_draft": "Subject: Statutory Notice: Overdue Invoice #112 & MSMED Act Interest Remittance..."
    }
  ],
  "disclaimer": "Statutory penal calculations are modeled under Sections 15 & 16 of the MSMED Act, 2006 and Section 43B(h) of the Income Tax Act, 1961..."
}
```

---

### `GET /api/calendar`
Returns scheduled outgoing cash commitments across a rolling 42-day window, combining statutory deadlines (TDS, PF, ESI, GSTR-3B, Advance Tax) with persisted vendor bills and recurring operational obligations.

#### Query Parameters
- `business_id` (string): Business entity ID (default: `"apex_precision_mfg"`)
- `window_days` (int): Horizon in days (default: `42`)

#### Response (`200 OK`)
```json
{
  "reference_date": "2026-10-24",
  "horizon_days": 42,
  "end_date": "2026-12-05",
  "total_committed_amount": 1015000.0,
  "category_totals": {
    "Statutory": 170000.0,
    "Payroll": 360000.0,
    "Loan repayments": 120000.0,
    "Supplier payments": 265000.0,
    "Other recurring expenses": 100000.0
  },
  "payments_count": 13,
  "scheduled_payments": [ ... ]
}
```

---

### `GET /api/backtest`
Retrieves empirical forecast reliability metrics, prediction band coverage, warning lead times, false alarm ratios, and empirical calibration curve points evaluated across 12 historical periods against reconciled bank ledger actuals.

#### Query Parameters
- `business_id` (string): Business entity ID (default: `"apex_precision_mfg"`)
- `evaluation_periods` (int): Number of historical evaluation periods (default: `12`)

#### Response (`200 OK`)
```json
{
  "business_id": "apex_precision_mfg",
  "dataset_name": "Apex Precision Components Pvt Ltd (Reconciled Operating Ledger)",
  "is_synthetic": true,
  "evaluation_periods": 12,
  "band_coverage_pct": 78,
  "band_coverage_target_pct": 80,
  "warning_lead_time_days": 19,
  "false_alarms_ratio": "1 in 8",
  "missed_shortfalls_count": 0,
  "mean_absolute_error_inr": 18400.0,
  "mean_absolute_error_formatted": "₹18.4k",
  "trust_score": 90.8,
  "calibration_curve": [
    { "predicted": 10, "actual": 12 },
    { "predicted": 25, "actual": 26 },
    { "predicted": 50, "actual": 48 },
    { "predicted": 75, "actual": 74 },
    { "predicted": 90, "actual": 88 }
  ],
  "methodology_notes": [ ... ]
}
```

---

## 2. Customer & Shopkeeper Integration Endpoints

### `GET /api/customer/dashboard`
Retrieves customer summary profile, active dues, shops count, and friendly non-judgmental guidance message.

#### Query Parameters
- `customer_id` (string): Customer ID (default: `"cust_rahul_01"`)

---

### `POST /api/customer/credit-transactions`
Records a purchase made on credit with optional initial downpayment. Supports `idempotency_key`.

#### Request Body
```json
{
  "shop_code": "KOSHA-LAKSHMI",
  "description": "Hardware Fittings & Fasteners",
  "purchase_amount": 1500.0,
  "amount_paid_now": 500.0,
  "agreed_repayment_date": "2026-11-05",
  "idempotency_key": "idemp_cust_tx_123"
}
```

---

### `POST /api/customer/repayments`
Records an auditable repayment towards an outstanding credit balance.

#### Request Body
```json
{
  "amount": 500.0,
  "payment_method": "demo_upi",
  "notes": "Payment via UPI",
  "idempotency_key": "idemp_rep_456"
}
```

---

### `GET /api/shops/{shop_code}/qr`
Generates authoritative SVG QR code and instructions for merchant shops.

#### Response (`200 OK`)
```json
{
  "shop_code": "KOSHA-APEX",
  "shop_name": "Apex Precision Works",
  "qr_payload": "kosha://shop/KOSHA-APEX",
  "qr_svg": "<svg ...></svg>",
  "instructions": "Scan this QR code with the KOSHA Customer app or enter shop code KOSHA-APEX to record credit purchases."
}
```

---

### `GET /api/shopkeeper/shop/summary`
Calculates authoritative receivables summary KPIs for shopkeepers from persistent records.

---

### `POST /api/payment-gateway/initiate`
Initiates a payment order with persistent idempotency.

#### Request Body
```json
{
  "transaction_id": "ctx_demo_01",
  "amount": 500.0,
  "idempotency_key": "idemp_order_789"
}
```

---

### `POST /api/payment-gateway/webhook`
Idempotent webhook endpoint for asynchronous payment status updates.

#### Request Body
```json
{
  "event_id": "evt_razorpay_mock_123",
  "payload": {
    "event": "payment.captured",
    "payment_id": "pay_mock_456",
    "amount": 50000
  }
}
```

---

### `POST /api/notifications/evaluate`
Scans active credit transactions, evaluates due dates in `Asia/Kolkata`, and schedules persistent deduplicated notifications.

#### Response (`200 OK`)
```json
{
  "evaluation_date": "2026-10-24",
  "timezone": "Asia/Kolkata",
  "active_transactions_evaluated": 5,
  "generated_notifications_count": 2,
  "skipped_duplicates_count": 0
}
```




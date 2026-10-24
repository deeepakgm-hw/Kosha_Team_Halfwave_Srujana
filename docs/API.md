# KOSHA — API Specification

> **Base URL:** `/api`  
> **Protocol:** HTTP/1.1 REST with JSON payloads  
> **Status:** Phase 1 Foundation (`/api/health` implemented; remaining endpoints reserved).

---

## Endpoint Matrix

| Method | Endpoint | Phase 1 Status | Responsibility |
|---|---|---|---|
| `GET` | `/api/health` | **Implemented** | Application health, uptime, version, and environment status |
| `POST` | `/api/load/sample` | *Reserved* | Load pre-seeded synthetic SME business personas (e.g. Acme Precision Tools) |
| `POST` | `/api/load/csv` | *Reserved* | Ingest and validate uploaded transaction and invoice CSV datasets |
| `GET` | `/api/state` | *Reserved* | Current liquid balance, open payables, receivables summary, and alert status |
| `POST` | `/api/forecast` | *Reserved* | Generate rolling 90-day probabilistic daily cash trajectory |
| `POST` | `/api/simulate` | *Reserved* | Simulate what-if financial shocks (delayed payments, revenue drop, capex) |
| `POST` | `/api/actions/rank` | *Reserved* | Return prioritized interventions ranked by cash impact, cost, and speed |
| `GET` | `/api/receivables/law` | *Reserved* | Invoices with MSMED Act 45-day overdue warnings and penal interest |
| `GET` | `/api/calendar` | *Reserved* | Consolidated schedule of payroll, vendor dues, and statutory tax dates |
| `POST` | `/api/backtest` | *Reserved* | Calculate forecast accuracy vs historical actuals to compute Trust Score |
| `GET` | `/api/brief` | *Reserved* | Plain-English executive briefing of cash runway risks and immediate steps |
| `GET` | `/api/export/csv` | *Reserved* | Export 90-day daily forecast table to downloadable CSV format |

---

## 1. Implemented Endpoints

### `GET /api/health`
Returns system status, service version, server timestamp, and environment.

#### Request
```http
GET /api/health HTTP/1.1
Host: localhost:8000
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "app_name": "KOSHA — Predictive Cash-Flow Engine",
  "version": "0.1.0",
  "timestamp": "2026-10-24T06:15:00.000000Z",
  "environment": "development"
}
```

---

## 2. Reserved Endpoints (Planned for Subsequent Phases)

### `POST /api/load/sample`
Loads synthetic business profile data.
- **Request Body:** `{ "persona": "manufacturing_sme" | "tech_agency" | "retailer" }`
- **Response:** Summary of loaded transactions, invoices, and starting cash balance.

### `POST /api/load/csv`
Uploads raw transaction/invoice files for automated schema parsing and validation.
- **Payload:** `multipart/form-data` with `file: bank_statement.csv` or `invoices.csv`.
- **Response:** Ingestion report with valid row counts, errors, and flagged anomalies.

### `GET /api/state`
Returns the operational snapshot of the business.
- **Response:**
  - `current_cash`: Settled liquid cash balance in INR.
  - `burn_rate_monthly`: Average monthly net cash outflow.
  - `runway_days`: Days until cash reaches zero under baseline assumptions.
  - `risk_level`: `low` | `moderate` | `critical`.

### `POST /api/forecast`
Runs the 90-day rolling cash forecast.
- **Request Body:**
  ```json
  {
    "horizon_days": 90,
    "confidence_interval": 0.90,
    "include_stochastic_receivables": true
  }
  ```
- **Response:** Daily time series containing `date`, `baseline_cash`, `lower_bound`, `upper_bound`, and `net_flow`.

### `POST /api/simulate`
Applies what-if scenario overrides against the forecast baseline.
- **Request Body:**
  ```json
  {
    "scenario_type": "delayed_receivable",
    "params": {
      "counterparty_id": "cust_101",
      "delay_days": 30
    }
  }
  ```
- **Response:** Delta analysis comparing baseline vs simulated runway and earliest shortfall date.

### `POST /api/actions/rank`
Ranks available corrective actions.
- **Request Body:**
  ```json
  {
    "target_shortfall_date": "2026-11-15",
    "deficit_amount": 250000
  }
  ```
- **Response:** Ordered list of actionable recommendations with liquidity yield, speed, cost, and friction scores.

### `GET /api/receivables/law`
Provides legal compliance visibility under the MSMED Act 2006.
- **Response:** Overdue invoices exceeding 45 days, accrued penal interest (calculated at 3x RBI bank rate), and pre-drafted legal notice previews.

### `GET /api/calendar`
Returns calendar events for cash commitments over the next 90 days.
- **Response:** Array of events categorized as `payroll`, `vendor_due`, `gst_return`, `tds_deposit`, or `advance_tax`.

### `POST /api/backtest`
Audits forecast accuracy using sliding window historical evaluations.
- **Response:** Mean Absolute Percentage Error (MAPE), directional accuracy rate, and composite Trust Score (0-100).

### `GET /api/brief`
Generates a 3-bullet executive summary for the business owner.
- **Response:** `{ "headline": "...", "points": [...], "suggested_first_action": "..." }`.

### `GET /api/export/csv`
Streams the 90-day forecast projection into a CSV spreadsheet.
- **Response:** `text/csv` stream with headers `Date,StartingBalance,ExpectedInflow,CommittedOutflow,EndingBalance,Status`.

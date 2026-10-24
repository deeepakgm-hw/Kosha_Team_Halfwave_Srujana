# KOSHA — Predictive Cash-Flow Early Warning for Small Businesses

> **Tagline:** Know your treasury before it runs dry.  
> **Problem Statement:** Srujana Tech Fest 2026 — Finance Theme (F-03: Predictive Cash-Flow Management for Small Businesses).  
> **Team:** Halfwave  
> **Current Status:** Feature-Complete Hackathon MVP with Genuine Financial Math, Real Database Seeding, Live What-If Simulation, and Trilingual Localization.

---

## 1. Executive Overview

Small business owners routinely struggle with sudden liquidity crises, not because their businesses are unprofitable, but because cash timing is unpredictable:
- Invoices are delayed well beyond credit terms.
- Statutory tax obligations (GST, TDS, PF/ESI, Advance Tax) carry non-negotiable legal penalties.
- Fixed payroll and raw material commitments cannot wait for slow customer remittances.

**KOSHA** bridges the gap between historical accounting software and forward predictive treasury management. Over a rolling 90-day horizon, KOSHA calculates daily liquid cash, evaluates debtor payment delay risks, models what-if disruptions, and ranks high-impact corrective actions before cash runs out.

### Strict Categorical Distinction
KOSHA strictly isolates financial data categories:
1. **Settled Cash:** Reconciled bank funds (100% certainty, verified against statements).
2. **Expected Inflows:** Invoiced receivables adjusted for contractual credit terms and counterparty payment delays.
3. **Committed Outflows:** Scheduled payroll, shed rent, machinery EMIs, and non-negotiable statutory tax liabilities.
4. **Forecast Balances:** Rolling daily baseline cash trajectory strictly preserving $\text{Closing Cash} = \text{Opening Cash} + \text{Inflows} - \text{Outflows}$.
5. **Shortfall Risks:** Flagged liquidity deficits with advance warning lead times (distinguishing safety-buffer breaches from zero-cash shortfalls).

---

## 2. Architecture & Tech Stack

```
KOSHA Architecture:
├── Frontend: React 18 • TypeScript • Tailwind CSS • Vite • Lucide Icons • Recharts
├── Backend:  Python 3.14/3.11+ • FastAPI • SQLAlchemy 2.0 • Pydantic V2 • SQLite • NumPy
└── Testing:  Pytest (40 tests passing) • Vitest (10 tests passing) & React Testing Library
```

### Primary Five-Step Workflow
```
1. Load Data → 2. Understand Cash Flow → 3. Test Scenarios → 4. Compare Actions → 5. Action Plan
```
- **1. Load Data (`/load`):** Sample business selector (Manufacturer, Trader, Service) or strict CSV statement upload with cryptographic SHA-256 deduplication.
- **2. Understand Cash Flow (`/understand-cash-flow`):** Reconciled opening cash, expected receipts, 90-day trajectory, safety buffer breach vs zero-cash alerts, and Recharts area visualization.
- **3. Test Scenarios (`/test-scenarios`):** Interactive what-if shocks (buyer delay days, sales drop %, unexpected emergency expenses) debounced at 250ms and recalculated live on the backend.
- **4. Compare Actions (`/compare-actions`):** Ranked corrective actions (early payment discount, supplier extension, collections chase, discretionary capex deferral) scored via Multi-Criteria Decision Analysis (MCDA).
- **5. Action Plan (`/action-plan`):** Formulated execution plan with practical operational steps, print-friendly stylesheet for PDF generation, CSV export, and clipboard summary.

### Supporting Capabilities
- **Receivables & Late Payments (`/receivables`):** MSMED Act 2006 (Section 15 & 16: compound penal interest with monthly rests at 3x RBI Bank Rate = 19.50% p.a.), Income Tax Section 43B(h) buyer deduction disallowance tracking, and editable statutory notice drafts.
- **Cash Calendar (`/calendar`):** 42-day (6-week) scheduled disbursements categorized into Statutory (TDS, PF, ESI, GSTR-3B, Advance Tax), Payroll, Loan repayments, Supplier payments, and Other recurring expenses.
- **Forecast Reliability (`/reliability`):** Model calibration curves, 12 historical evaluation periods, prediction band coverage (78%), median advance warning lead time (19 days), 1 in 8 false alarm ratio, 0 missed shortfalls, and ₹18.4k MAE.

---

## 3. Quick Start & Local Setup

### Step 1: Install Backend Dependencies
```bash
python -m pip install -r backend/requirements.txt
```

### Step 2: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 4. Running the Application

**Terminal 1 — Backend (FastAPI):**
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Health Check: `http://127.0.0.1:8000/api/health`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`

**Terminal 2 — Frontend (Vite + React):**
```bash
cd frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 5. Automated Tests

### Backend Tests (Pytest)
```bash
python -m pytest backend/tests -v
```
**Result:** **40 passed in 1.21s** (covers ledger reconciliation, CSV parser encoding/deduplication, invoice/bill persistence, 90-day forecast, scenario shocks, MCDA action ranking, MSMED Section 16 compounding rests, cash calendar, and backtest calibration).

### Frontend Tests (Vitest)
```bash
npm --prefix frontend test -- --run
```
**Result:** **10 passed across 4 test suites** (covers Button, App router, forecast loading/success/error, reserve alerts, and trilingual translation switching).

### Production Build
```bash
npm --prefix frontend run build
```
**Result:** TypeScript compilation (`tsc -b`) and Vite production bundle succeed with 0 errors.

---

## 6. API Route Contracts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and version info |
| `GET` | `/api/businesses` | List registered and demo business entities |
| `POST` | `/api/statements/import-csv` | Multi-format bank statement CSV parser with SHA-256 deduplication |
| `POST` | `/api/forecast` | Rolling 90-day cash forecast with runway and shortfall detection |
| `POST` | `/api/simulate` | Comparative what-if scenario shock engine |
| `POST` | `/api/actions/rank` | MCDA-based corrective intervention priority ranker |
| `GET` | `/api/receivables/law` | MSMED Section 16 penal interest & Section 43B(h) compliance |
| `GET` | `/api/calendar` | 42-day scheduled cash outflows categorized by commitment type |
| `GET` | `/api/backtest` | Empirical backtest replay metrics and calibration coordinates |

---

## 7. Disclaimers & Limitations

1. **Planning Aid:** KOSHA provides early-warning forecasting and treasury scenario analysis for management planning. It does not constitute formal financial, legal, or tax advice.
2. **Statutory Calculations:** Calculations under Sections 15 & 16 of the MSMED Act, 2006 and Section 43B(h) of the Income Tax Act, 1961 are algorithmic estimations based on statutory formulas. Users should verify specific supplier eligibility with a certified Chartered Accountant.
3. **Synthetic Demo Data:** All sample business personas (Apex Precision Components, GreenGrocer Hub, PixelCraft Studio) use synthetic demo data explicitly labeled as simulated demonstration records.
4. **AI-Assisted Development:** Developed for Srujana Tech Fest 2026 using agentic coding assistance in strict compliance with hackathon regulations.

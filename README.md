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
├── Frontend: React 18 • TypeScript • Tailwind CSS • Vite • Lucide Icons • Recharts • html5-qrcode
├── Backend:  Python 3.14/3.11+ • FastAPI • SQLAlchemy 2.0 • Pydantic V2 • SQLite • NumPy
└── Testing:  Pytest (82 tests passing) • Vitest (25 tests passing) & React Testing Library
```

### Connected Product Experiences
1. **Business Owner Experience (`/load`):**
   - **5-Step Treasury Flow:** 1. Load Data → 2. Understand Cash Flow → 3. Test Scenarios → 4. Compare Actions → 5. Action Plan.
   - **Supporting Tools:** Receivables & MSMED Act Law (`/receivables`), 42-day Cash Calendar (`/calendar`), Forecast Reliability & Calibration (`/reliability`).
   - **Shopkeeper Counter Experience (`/shopkeeper`):** Real-time receivables summary, shop QR code generation, transaction status filters, and counter cash collection.
2. **Customer Experience (`/customer`):**
   - Dual-persona login and entry page with non-judgmental guidance.
   - Active shop credit dues and upcoming repayment schedule.
   - QR code scanner (`html5-qrcode`) to record purchases at participating shops.
   - Direct digital repayments via transparent Payment Gateway Sandbox.

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
**Result:** **82 passed in 6.60s** (includes 20 data integrity & idempotency scenarios covering duplicate prevention, in-file repetitions, UTR discriminators, full settlement, overpayment rejection, webhook idempotency, and Asia/Kolkata timezone scheduled reminders).

### Frontend Tests (Vitest)
```bash
npm --prefix frontend test
```
**Result:** **25 passed across 7 test suites** (covers Button, App router, forecast loading/success/error, reserve alerts, trilingual localization, Customer dashboard, Shopkeeper credit & QR code flows, and Bank Statement import with rejected CSV downloads).

### Production Build
```bash
npm --prefix frontend run build
```
**Result:** TypeScript compilation (`tsc -b`) and Vite production bundle succeed with 0 errors.

---

## 6. Primary API Route Matrix

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and version info |
| `GET` | `/api/businesses` | List registered and demo business entities |
| `POST` | `/api/statements/import-csv` | Multi-format bank statement CSV parser with SHA-256 deduplication & rejected row export |
| `GET` | `/api/statements/duplicates/audit` | Scan database for existing duplicate transactions and file hashes |
| `POST` | `/api/statements/duplicates/cleanup` | Cleanup redundant duplicate records with dry-run audit mode |
| `POST` | `/api/forecast` | Rolling 90-day cash forecast with runway and shortfall detection |
| `POST` | `/api/simulate` | Comparative what-if scenario shock engine |
| `POST` | `/api/actions/rank` | MCDA-based corrective intervention priority ranker |
| `GET` | `/api/receivables/law` | MSMED Section 16 penal interest & Section 43B(h) compliance |
| `GET` | `/api/calendar` | 42-day scheduled cash outflows categorized by commitment type |
| `GET` | `/api/backtest` | Empirical backtest replay metrics and calibration coordinates |
| `GET` | `/api/customer/dashboard` | Customer profile summary, active dues, upcoming commitments |
| `POST` | `/api/customer/credit-transactions` | Record shop purchase on credit with down-payment |
| `POST` | `/api/customer/repayments` | Record customer repayment towards outstanding credit |
| `GET` | `/api/shops/{shop_code}/qr` | Generate authoritative SVG QR code and instructions |
| `GET` | `/api/shopkeeper/shop/summary` | Shopkeeper receivables summary KPIs and today's collections |
| `POST` | `/api/payment-gateway/initiate` | Initiate payment order with persistent idempotency |
| `POST` | `/api/payment-gateway/webhook` | Idempotent webhook handler with unique event tracking |
| `POST` | `/api/notifications/evaluate` | Evaluate repayment dates in Asia/Kolkata and schedule deduplicated reminders |

---

## 7. Disclaimers & Limitations

1. **Planning Aid:** KOSHA provides early-warning forecasting and treasury scenario analysis for management planning. It does not constitute formal financial, legal, or tax advice.
2. **Statutory Calculations:** Calculations under Sections 15 & 16 of the MSMED Act, 2006 and Section 43B(h) of the Income Tax Act, 1961 are algorithmic estimations based on statutory formulas. Users should verify specific supplier eligibility with a certified Chartered Accountant.
3. **Synthetic Demo Data:** All sample business personas (Apex Precision Components, GreenGrocer Hub, PixelCraft Studio) use synthetic demo data explicitly labeled as simulated demonstration records.
4. **AI-Assisted Development:** Developed for Srujana Tech Fest 2026 using agentic coding assistance in strict compliance with hackathon regulations.

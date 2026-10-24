# KOSHA — Predictive Cash-Flow Early Warning for Small Businesses

> **Tagline:** Know your treasury before it runs dry.  
> **Problem Statement:** Finance F-03 — Predictive Cash-Flow Management for Small Businesses.  
> **Event:** Srujana Tech Fest 2026 (48-Hour Hackathon).  
> **Current Status:** Phase 1 — Project Foundation & Application Scaffolding.

---

## 1. Executive Overview

Small business owners routinely struggle with sudden liquidity crises, not because their businesses are unprofitable, but because cash timing is unpredictable:
- Invoices are delayed well beyond credit terms.
- Statutory tax obligations (GST, TDS, Advance Tax) carry non-negotiable statutory penalties.
- Fixed payroll and supplier commitments cannot wait for slow customer remittances.

**KOSHA** bridges the gap between historical accounting and forward predictive treasury management. Over a rolling 90-day horizon, KOSHA calculates daily liquid cash, evaluates debtor payment delay risks, models what-if disruptions, and ranks high-impact corrective actions before cash runs out.

### Strict Categorical Distinction
KOSHA strictly isolates financial data categories:
1. **Settled Cash:** Reconciled bank funds (100% certainty).
2. **Expected Inflows:** Invoiced receivables adjusted for counterparty delay probability (weighted 40%–85%).
3. **Committed Outflows:** Scheduled payroll, rent, and non-negotiable statutory tax liabilities.
4. **Forecast Balances:** Rolling daily baseline cash trajectory.
5. **Shortfall Risks:** Flagged liquidity deficits with advance warning.

*All demo records and sample personas are 100% synthetic and labeled accordingly.*

---

## 2. Architecture & Tech Stack

```
KOSHA Architecture:
├── Frontend: React 18 • TypeScript • Tailwind CSS • Vite • Lucide Icons • Recharts
├── Backend:  Python 3.14/3.11+ • FastAPI • Pydantic V2 • NumPy • Pandas • SQLite
└── Testing:  Pytest (Backend) • Vitest & React Testing Library (Frontend)
```

For complete architectural details, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).  
For the API endpoints specification, see [docs/API.md](docs/API.md).  
For data structures and personas, see [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md).

---

## 3. Repository Structure

```
Kosha/
├── frontend/                   # React + TypeScript + Vite web application
│   ├── public/                 # Static assets (favicon, etc.)
│   ├── src/
│   │   ├── app/                # Root App, router, and context providers
│   │   ├── components/         # Reusable UI (Button, Card, Badge), Layout, Feedback
│   │   ├── features/           # Feature pages (Know, Decide, Act, Receivables, Calendar, Trust)
│   │   ├── lib/                # Centralized API client & utility helpers
│   │   ├── types/              # TypeScript interfaces for API and financial models
│   │   ├── test/               # Vitest test suite and component test fixtures
│   │   ├── index.css           # Tailwind base styles and theme
│   │   └── main.tsx            # DOM mount point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                    # Python FastAPI application
│   ├── app/
│   │   ├── main.py             # FastAPI entry point & CORS configuration
│   │   ├── api/                # API router and versioned endpoint handlers
│   │   ├── core/               # Configuration settings and structured error handling
│   │   ├── schemas/            # Pydantic request/response validation models
│   │   ├── domain/             # Pure financial calculation logic (ledger, simulator, MSMED, etc.)
│   │   ├── services/           # Application coordination layer
│   │   ├── data/               # Synthetic data generators, personas, and validators
│   │   └── db/                 # SQLite database engine and ORM models
│   ├── tests/                  # Pytest test suite (health check, ledger logic)
│   ├── requirements.txt
│   └── pyproject.toml
│
├── data/
│   ├── sample/                 # Static synthetic persona fixtures
│   └── generated/              # Output directory for synthetic test runs
│
├── docs/                       # Technical architecture, API contracts, and data schemas
├── scripts/                    # Developer utility scripts (environment verification)
├── Makefile                    # Make targets for dev automation
├── .editorconfig
├── .gitignore
└── README.md
```

---

## 4. Prerequisites

- **Python:** Version 3.11 or newer (Python 3.14 supported).
- **Node.js:** Version 18.x or newer (Node v22 LTS tested).
- **npm:** Version 9.x or newer.

To quickly verify your system environment, run:
```bash
python scripts/check_env.py
```

---

## 5. Quick Start & Local Setup

### Step 1: Clone and Configure Environment
```bash
# Clone the repository
git clone https://github.com/your-org/kosha.git
cd kosha

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
*(On Windows PowerShell, use `Copy-Item .env.example .env`)*

### Step 2: Install Backend Dependencies
```bash
# Optional: create a virtual environment
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Linux/macOS: source .venv/bin/activate

python -m pip install -r backend/requirements.txt
```

### Step 3: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 6. Running the Application

### Option A: Using Direct Commands (Recommended for all platforms)

**Terminal 1 — Backend (FastAPI):**
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Health Check: `http://localhost:8000/api/health`
- Interactive Swagger UI: `http://localhost:8000/docs`

**Terminal 2 — Frontend (Vite + React):**
```bash
cd frontend
npm run dev
```
- Web Application: `http://localhost:5173`

### Option B: Using Makefile (Linux / macOS / Git Bash)
```bash
make install    # Installs both backend and frontend dependencies
make backend    # Runs FastAPI server
make frontend   # Runs Vite frontend
make test       # Executes all test suites
```

---

## 7. Running Tests

### Backend Tests (Pytest)
Tests verify the FastAPI health endpoint and pure domain ledger calculations without requiring a running server:
```bash
python -m pytest backend/tests -v
```

### Frontend Tests (Vitest + React Testing Library)
Tests verify core UI components and initial route mounting:
```bash
cd frontend
npm test
```

---

## 8. Implementation Status (Phase 1 Foundation)

| Component / Feature | Status | Notes |
|---|---|---|
| **FastAPI Core & Health API** | **Functional** | `GET /api/health` responds with uptime, version, and environment. |
| **Domain Ledger Logic** | **Functional** | Pure Python ledger math verified with unit tests. |
| **Domain Stubs** | **Scaffolded** | `simulator.py`, `scenarios.py`, `actions.py`, `msmed_law.py`, `statutory.py`, `backtest.py`. |
| **Frontend Shell & Layout** | **Functional** | Sidebar, Navbar with live backend status indicator, Synthetic Data banner. |
| **Frontend Navigation** | **Functional** | All 6 primary views mounted (`/`, `/scenarios`, `/actions`, `/receivables`, `/calendar`, `/trust`). |
| **API Client** | **Functional** | Type-safe fetch wrapper reading from `VITE_API_BASE_URL`. |
| **Synthetic Personas** | **Functional** | Sample persona fixtures loaded in `data/sample/`. |
| **Full 90-Day Simulation Engine** | *Reserved (Phase 2)* | Endpoint `POST /api/forecast` reserved in API spec. |
| **Interactive Scenario Sliders** | *Reserved (Phase 2)* | Endpoint `POST /api/simulate` reserved in API spec. |
| **Action Priority Matrix** | *Reserved (Phase 2)* | Endpoint `POST /api/actions/rank` reserved in API spec. |

---

## 9. Next Recommended Tasks for Team (Phase 2)

1. Implement `POST /api/forecast` in `backend/app/domain/simulator.py` to calculate rolling daily balances.
2. Connect Recharts in `frontend/src/features/forecast/` and `DashboardPage.tsx` to display the 90-day time series.
3. Wire the MSMED Act overdue computation to render formal demand notice templates in `ReceivablesPage.tsx`.

# KOSHA — Architecture & Technical Design

> **Tagline:** Know your treasury before it runs dry.  
> **Problem Statement:** Finance F-03 — Predictive Cash-Flow Management for Small Businesses.  
> **Event:** Srujana Tech Fest 2026 (48-hour Hackathon).

---

## 1. System Vision & The Three-Pillar Paradigm

KOSHA gives micro and small enterprise (MSE) owners forward visibility into their cash runway over a rolling 90-day horizon. Most accounting software only records what already happened; KOSHA anticipates what will happen under real-world conditions like customer payment delays, statutory tax cliffs, and supplier credit cycles.

The system is organized around three operational pillars:

```
┌─────────────────────────────────────────────────────────────┐
│                           KOSHA                             │
├─────────────────┬───────────────────┬───────────────────────┤
│    1. KNOW      │    2. DECIDE      │        3. ACT         │
│  (Visibility)   │   (Simulation)    │     (Intervention)    │
├─────────────────┼───────────────────┼───────────────────────┤
│ • Current cash  │ • Delayed debtor  │ • Early pay discount  │
│ • 90-day runway │ • Revenue shocks  │ • Capex deferral      │
│ • Shortfall date│ • Capex timing    │ • MSMED notice        │
│ • Burn rate     │ • Credit shifts   │ • Working cap loan    │
└─────────────────┴───────────────────┴───────────────────────┘
```

---

## 2. Layered Architecture

KOSHA follows a strict clean architecture pattern to ensure that the core domain financial logic is completely decoupled from web frameworks (FastAPI), presentation libraries (React), and persistence engines (SQLite).

```
┌─────────────────────────────────────────────────────────────┐
│                 Presentation Layer (React)                  │
│  Vite • TypeScript • Tailwind CSS • Recharts • React Router │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON over HTTP (REST)
┌──────────────────────────────▼──────────────────────────────┐
│                  API Transport Layer (FastAPI)              │
│      Route Handlers • Pydantic Schemas • CORS • Errors       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Typed Service Calls
┌──────────────────────────────▼──────────────────────────────┐
│                    Application Service Layer                │
│    Orchestrates workflow, loads profiles, applies scenarios │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pure Functional Calls
┌──────────────────────────────▼──────────────────────────────┐
│                     Domain Financial Core                   │
│  • Ledger & Balance math     • MSMED 45-day calculation     │
│  • Payment delay probability • Statutory calendar (GST/TDS) │
│  • 90-day rolling simulator  • Action ranking matrix        │
│  • Scenario stress-testing   • Backtest validation engine   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Data & Persistence Layer                  │
│  • SQLite (SQLAlchemy 2.0)   • Synthetic Data Generator     │
│  • Seeded business personas  • CSV Ingestion adapter        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Financial Category Separation

To avoid misleading business owners, KOSHA strictly categorizes all financial movements into distinct buckets:

| Category | Definition | Confidence Level | Visual Representation |
|---|---|---|---|
| **Settled Cash** | Cleared balance in bank accounts / liquid funds | 100% | Solid emerald / blue |
| **Committed Payables** | Scheduled payroll, rent, contracted vendor dues | 90–99% | Solid rose / crimson |
| **Statutory Dues** | GST, TDS, advance tax, PF/ESI with non-negotiable deadlines | 95% | Amber warning |
| **Expected Receivables** | Invoiced sales subject to historical payment latency | Weighted (40–85%) | Striped / dashed emerald |
| **Forecast Baseline** | Cumulative cash trajectory without intervention | Projected | Solid line with confidence band |
| **Simulated Path** | Cash trajectory under active scenario parameters | Hypothetical | Dotted purple / contrasting line |

---

## 4. Backend Domain Modules

All core calculations reside in `backend/app/domain/` as pure, deterministic Python functions:

1. **`ledger.py`**: Computes point-in-time cash balances from reconciled credits and debits.
2. **`payment_model.py`**: Estimates customer payment lag based on historical behavior, counterparty credit rating, and invoice age.
3. **`simulator.py`**: Runs the rolling 90-day daily cash projection combining deterministic payables and probabilistically weighted inflows.
4. **`scenarios.py`**: Applies parametric disruptions (e.g. top client delays payment by 30 days, 20% revenue drop).
5. **`actions.py`**: Evaluates and ranks corrective actions based on liquidity impact, execution speed, and financial cost.
6. **`statutory.py`**: Encapsulates Indian statutory deadlines (GSTR-3B on 20th, TDS on 7th, Advance Tax quarterly).
7. **`msmed_law.py`**: Implements Micro, Small and Medium Enterprises Development (MSMED) Act provisions (45-day payment limit and compounding monthly penal interest at 3x bank rate).
8. **`backtest.py`**: Compares past projections with actual historical receipts to compute forecast reliability score (Trust Score).

---

## 5. Synthetic Data Policy

- All sample data provided in `data/sample/` or generated via `generator.py` is **100% synthetic**.
- Every synthetic entity is tagged with `is_synthetic: true`.
- The user interface prominently features a synthetic data disclaimer banner across all views.
- No real banking credentials or confidential customer records are collected or stored.

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
│    Import Service • Billing Service • Cashflow Service       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pure Functional & ORM Calls
┌──────────────────────────────▼──────────────────────────────┐
│                     Domain Financial Core                   │
│  • CSV Parser & Encoding Sniffer (UTF-8, Latin-1, CP1252)   │
│  • Decimal Monetary Arithmetic                              │
│  • 90-Day Rolling Simulator (Reserve breach & Shortfall)    │
│  • MSMED Act 45-day calculation & Penal Interest            │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Data & Persistence Layer                  │
│  • SQLite (SQLAlchemy 2.0 with Numeric(15, 2))              │
│  • SHA256 Batch Deduplication & Transaction Fingerprints    │
│  • Demo persona fallback strictly isolated                  │
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
| **Forecast Baseline** | Cumulative cash trajectory without intervention | Projected | Solid line with zero & reserve lines |
| **Simulated Path** | Cash trajectory under active scenario parameters | Hypothetical | Dotted purple / contrasting line |

---

## 4. Persistent Financial Data Architecture

1. **Decimal-Safe Calculations:** All monetary calculations use Python `Decimal` objects and SQLAlchemy `Numeric(15, 2, asdecimal=True)`. Floating-point arithmetic is never used for balance conservation.
2. **Atomic Statement Ingestion:** The CSV import engine sniffs character encodings, detects headers, validates dates across multiple formats (`YYYY-MM-DD`, `DD/MM/YYYY`, etc.), verifies positive/negative credit-debit conventions, computes SHA256 file hashes, and generates per-row transaction fingerprints. If an error occurs, the entire transaction rolls back cleanly.
3. **Overpayment Prevention:** Payments recorded against invoices or bills are strictly validated: attempting to pay more than the outstanding amount raises `ValidationError` with HTTP 422.
4. **Conservation Invariant:** In every daily step of the forecast simulation:
   $$\text{closing\_balance} = \text{opening\_balance} + \text{inflows} - \text{outflows}$$
5. **Reserve Safety Tracking:** In addition to detecting zero-cash deficits, the simulator tracks user-configured minimum safety reserves ($R_{\text{min}}$), reporting the exact date the reserve is breached and the number of days spent below reserve.

---

## 5. Real Data vs. Synthetic Demo Isolation

- **Real Data Mode:** Calculates metrics exclusively from SQLite database records. If a business has no bank accounts or transactions, KOSHA does not fabricate dummy numbers; it displays a first-run empty state and transparent data quality warnings (`NO_BANK_ACCOUNT`, `EMPTY_LEDGER`, `UNVERIFIED_OPENING_BALANCE`).
- **Demo Mode:** An isolated synthetic persona ("Apex Precision Components") with `is_synthetic: true` labels, allowing judges and users to explore full capabilities without corrupting real enterprise ledgers.

---

## 6. Mathematical & Domain Specifications

### A. Core Accounting Invariant
$$\text{Closing Cash}_t = \text{Opening Cash}_t + \sum \text{Inflows}_t - \sum \text{Outflows}_t$$
$$\text{Opening Cash}_{t+1} = \text{Closing Cash}_t$$

### B. MSMED Act 2006 (Section 16) Compounding with Monthly Rests
$$\text{Penal Rate} = 3 \times r_{\text{RBI}} \quad (\text{currently } 3 \times 6.50\% = 19.50\% \text{ p.a.})$$
$$A = P \times \left(1 + \frac{3 \times r_{\text{RBI}}}{12}\right)^{\lfloor d / 30 \rfloor} \times \left(1 + \frac{3 \times r_{\text{RBI}} \times (d \bmod 30)}{365}\right)$$
$$\text{Accrued Penal Interest} = A - P$$

### C. Multi-Criteria Action Prioritization (MCDA)
$$\text{MCDA Score} = w_{\text{yield}} \cdot \frac{\text{Yield}}{\text{Shortfall}} + w_{\text{velocity}} \cdot \left(\frac{1}{\text{Days to Cash}}\right) - w_{\text{cost}} \cdot \left(\frac{\text{Cost}}{\text{Yield}}\right) - w_{\text{friction}} \cdot \text{FrictionPenalty}$$

### D. Empirical Backtesting & Calibration
- 12 historical 7-day rolling evaluation windows.
- Prediction band coverage goal: 80% (empirical result: 78%).
- Asymmetric penalty: unpredicted liquidity deficits are penalized more heavily than over-conservatism.
- Calibration coordinates: $(10, 12), (25, 26), (50, 48), (75, 74), (90, 88)$.


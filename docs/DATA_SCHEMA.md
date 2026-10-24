# KOSHA — Data Schema Specification

> **Status:** Phase 1 Design Specification  
> **Synthetic Compliance:** All data models require explicit synthetic labeling (`is_synthetic: true`).

---

## 1. Entities Overview

The core data structures powering KOSHA include:
1. **Business Profile (`BusinessProfile`)**: The enterprise identity, industry, starting liquidity, and MSMED status.
2. **Transaction (`Transaction`)**: Settled historical credit/debit cash entries.
3. **Invoice Receivable (`Invoice`)**: Customer invoices with issue date, due date, terms, and counterparty payment history.
4. **Committed Payable (`Payable`)**: Vendor bills, rent, loan EMIs, and utility obligations.
5. **Statutory Obligation (`StatutoryObligation`)**: Tax calendar liabilities (GST, TDS, Advance Tax).
6. **Forecast Point (`ForecastPoint`)**: Daily projected cash balances with confidence intervals.

---

## 2. Pydantic / JSON Schemas

### `BusinessProfile`
```json
{
  "id": "biz_mfg_01",
  "legal_name": "Apex Precision Components Pvt Ltd",
  "trade_name": "Apex Precision",
  "industry": "Light Engineering / Auto Ancillary",
  "msme_category": "Small",
  "registration_number": "UDYAM-MH-01-0000000",
  "currency": "INR",
  "current_cash": 485000.0,
  "reconciled_date": "2026-10-24",
  "is_synthetic": true
}
```

### `Transaction` (Historical Ledger)
```json
{
  "id": "txn_84920",
  "business_id": "biz_mfg_01",
  "date": "2026-10-15",
  "type": "debit",
  "category": "raw_materials",
  "counterparty": "Tata Steel Distribution",
  "amount": 142000.0,
  "reference": "CHQ-984021",
  "is_synthetic": true
}
```

### `Invoice` (Accounts Receivable)
```json
{
  "id": "inv_2026_091",
  "business_id": "biz_mfg_01",
  "invoice_number": "INV-2026-091",
  "customer_id": "cust_mahindra_sub",
  "customer_name": "Tier-1 Auto Assemblers Ltd",
  "issue_date": "2026-09-01",
  "due_date": "2026-10-15",
  "amount": 320000.0,
  "paid_amount": 0.0,
  "status": "overdue",
  "days_overdue": 9,
  "msmed_eligible": true,
  "statutory_notice_allowed": false,
  "expected_pay_date": "2026-11-05",
  "payment_confidence": 0.75,
  "is_synthetic": true
}
```

### `Payable` (Accounts Payable / Fixed Outflows)
```json
{
  "id": "pay_nov_rent",
  "business_id": "biz_mfg_01",
  "vendor_name": "MIDC Industrial Shed Lessor",
  "category": "rent",
  "due_date": "2026-11-05",
  "amount": 75000.0,
  "priority": "critical",
  "negotiable": false,
  "is_synthetic": true
}
```

### `StatutoryObligation` (Indian Compliance Calendar)
```json
{
  "id": "stat_gst_oct_2026",
  "business_id": "biz_mfg_01",
  "obligation_type": "GSTR_3B",
  "tax_period": "2026-09",
  "due_date": "2026-10-20",
  "estimated_amount": 62500.0,
  "late_fee_per_day": 50.0,
  "is_paid": false,
  "is_synthetic": true
}
```

---

## 3. Personas for Demo Scenarios

KOSHA will provide three pre-packaged synthetic business personas:

1. **Persona A: "Apex Precision Components" (Manufacturing SME)**
   - High working capital intensity.
   - Long customer payment cycles (60-90 days).
   - High exposure to MSMED 45-day overdue receivables.
   - Fixed monthly payroll and power expenses.

2. **Persona B: "PixelCraft Digital" (Services / Consulting SME)**
   - Asset-light, heavy monthly payroll (10th of every month).
   - Moderate retainers with milestone billing risk.
   - Severe vulnerability if 1 of 3 anchor clients delays payment.

3. **Persona C: "GreenGrocer Retail Hub" (B2B Distributor)**
   - High inventory turnover, thin margins.
   - Strict supplier credit limits (vendor stop-supply risk).
   - Immediate cash flow sensitivity to GST outflow peaks.

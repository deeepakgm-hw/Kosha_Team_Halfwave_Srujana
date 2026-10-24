export type MSMEClassification = "Micro" | "Small" | "Medium";

export interface BusinessProfile {
  id: string;
  legal_name: string;
  trade_name: string;
  industry: string;
  msme_category: string;
  currency: string;
  registration_number?: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface BankAccount {
  id: string;
  business_id: string;
  bank_name: string;
  account_number_mask: string;
  currency: string;
  opening_balance: number;
  opening_balance_date: string;
  is_verified: boolean;
  created_at: string;
}

export interface RejectedRowDetail {
  row_number: number;
  raw_content: string;
  error: string;
}

export interface ReconciliationSummary {
  opening_balance: number | null;
  opening_balance_verified: boolean;
  total_credits: number;
  total_debits: number;
  net_movement: number;
  calculated_closing_balance: number | null;
  verification_notes: string;
}

export interface StatementPeriod {
  start_date: string | null;
  end_date: string | null;
}

export interface CsvImportResult {
  batch_id: string;
  business_id: string;
  filename: string;
  total_rows: number;
  accepted_rows: number;
  duplicate_rows: number;
  exact_file_duplicates?: number;
  previously_imported_duplicates?: number;
  potential_duplicates_review?: number;
  potential_duplicates_details?: Array<{
    row_number: number;
    date: string;
    amount: number;
    description: string;
    reason: string;
  }>;
  rejected_rows: number;
  rejected_details: RejectedRowDetail[];
  statement_period: StatementPeriod;
  reconciliation: ReconciliationSummary;
}

export interface BankTransaction {
  id: string;
  business_id: string;
  bank_account_id?: string | null;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: "credit" | "debit";
  external_reference?: string | null;
  is_reconciled: boolean;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  reference?: string | null;
  bank_transaction_id?: string | null;
  created_at: string;
}

export interface CustomerInvoice {
  id: string;
  business_id: string;
  invoice_number: string;
  customer_name: string;
  customer_id?: string | null;
  issue_date: string;
  due_date: string;
  expected_payment_date?: string | null;
  amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: "unpaid" | "partially_paid" | "paid" | "cancelled";
  msmed_eligible: boolean;
  notes?: string | null;
  payments: InvoicePayment[];
  created_at: string;
}

export interface BillPayment {
  id: string;
  bill_id: string;
  payment_date: string;
  amount: number;
  reference?: string | null;
  bank_transaction_id?: string | null;
  created_at: string;
}

export interface VendorBill {
  id: string;
  business_id: string;
  bill_number: string;
  vendor_name: string;
  vendor_id?: string | null;
  issue_date: string;
  due_date: string;
  category: string;
  amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: "unpaid" | "partially_paid" | "paid" | "cancelled";
  priority: "critical" | "normal" | "flexible";
  notes?: string | null;
  payments: BillPayment[];
  created_at: string;
}

export interface BusinessStateSummary {
  business_id: string;
  legal_name: string;
  currency: string;
  is_demo: boolean;
  current_cash: number;
  verified_opening_balance: number | null;
  total_settled_inflows: number;
  total_settled_outflows: number;
  total_unpaid_receivables: number;
  total_unpaid_payables: number;
  active_invoices_count: number;
  active_bills_count: number;
  imported_transactions_count: number;
  reconciliation_status: "verified" | "unverified" | "no_accounts";
  data_quality_warnings: string[];
}

export interface ForecastDailyPoint {
  date: string;
  starting_cash: number;
  expected_inflow: number;
  committed_outflow: number;
  net_cash_flow: number;
  ending_cash: number;
  is_shortfall: boolean;
  shortfall_amount: number;
  is_reserve_breach?: boolean;
  reserve_deficit?: number;
  confidence_lower?: number | null;
  confidence_upper?: number | null;
  is_synthetic: boolean;
}

export interface ForecastRequest {
  business_id?: string;
  start_date?: string;
  starting_cash?: number;
  horizon_days?: number;
  minimum_reserve?: number;
  receivables?: Array<{
    amount: number;
    expected_payment_date?: string;
    due_date?: string;
    customer_name?: string;
    status?: string;
  }>;
  outflows?: Array<{
    amount: number;
    due_date?: string;
    title?: string;
    category?: string;
  }>;
  use_sample_data?: boolean;
}

export interface ForecastResponse {
  business_id: string;
  forecast_generated_at: string;
  start_date: string;
  horizon_days: number;
  starting_cash: number;
  closing_cash: number;
  total_inflows: number;
  total_outflows: number;
  net_change: number;
  minimum_projected_balance: number;
  minimum_reserve: number;
  first_projected_shortfall_date: string | null;
  first_reserve_breach_date: string | null;
  negative_cash_days_count: number;
  days_below_reserve_count: number;
  runway_days: number | null;
  is_probabilistic: boolean;
  is_synthetic: boolean;
  data_quality_warnings: string[];
  assumptions_used: string[];
  daily_projections: ForecastDailyPoint[];
}

export interface CorrectiveAction {
  id: string;
  title: string;
  description: string;
  estimatedYield: number;
  daysToCash: number;
  costInr: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface ReceivableItem {
  id: string;
  customerName: string;
  amount: number;
  dueDate: string;
  status: "current" | "overdue" | "disputed";
  daysOverdue: number;
  msmedViolated: boolean;
  accruedPenalInterest: number;
  isSynthetic: boolean;
}

export type PersonaType = "manufacturer" | "trader" | "service";

export interface ScenarioSimulationRequest {
  business_id?: string;
  persona_id?: string;
  use_sample_data?: boolean;
  horizon_days?: number;
  minimum_reserve?: number;
  buyer_delay_days?: number;
  sales_drop_percent?: number;
  surprise_expense?: number;
  surprise_expense_day?: number;
}

export interface RiskComparisonMetrics {
  baseline_risk_pct: number;
  scenario_risk_pct: number;
  risk_delta_pct: number;
  baseline_first_breach_date: string | null;
  scenario_first_breach_date: string | null;
  baseline_first_shortfall_date: string | null;
  scenario_first_shortfall_date: string | null;
  baseline_min_balance: number;
  scenario_min_balance: number;
  minimum_balance_change: number;
  baseline_runway_days: number;
  scenario_runway_days: number;
}

export interface ScenarioShocksApplied {
  buyer_delay_days: number;
  sales_drop_percent: number;
  surprise_expense: number;
  surprise_expense_day: number;
}

export interface ScenarioSimulationResponse {
  baseline: ForecastResponse;
  scenario: ForecastResponse;
  risk_comparison: RiskComparisonMetrics;
  shocks_applied: ScenarioShocksApplied;
}

export interface ActionItemOut {
  id: string;
  badge: string;
  category: "discount" | "supplier_extension" | "chase_debtor" | "defer_expense";
  category_label: string;
  title: string;
  why_recommended: string;
  cash_flow_impact: string;
  risk_shift: string;
  cost: string;
  cost_inr: number;
  yield_inr: number;
  days_to_cash: number;
  relationship_cost: "Low" | "Medium" | "High";
  relationship_notes: string;
  assumptions: string;
  practical_steps: string[];
  mcda_score: number;
}

export interface ActionRankingResponse {
  business_id: string;
  shortfall_amount: number;
  days_until_shortfall: number;
  actions: ActionItemOut[];
}

export interface ReceivablesLawInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  due_date: string;
  overdue_days: number;
  is_violation: boolean;
  penal_rate_annual: string;
  accrued_penal_interest: number;
  total_claimable: number;
  section_43b_status: string;
  section_43b_notes: string;
  statutory_reminder_draft: string;
}

export interface ReceivablesLawResponse {
  business_id: string;
  rbi_bank_rate_pct: number;
  msmed_penal_rate_pct: number;
  compounding_frequency: string;
  total_overdue_principal: number;
  total_accrued_penal_interest: number;
  invoices: ReceivablesLawInvoice[];
  disclaimer: string;
}

export interface CalendarOutflowItem {
  id: string;
  date: string;
  formatted_date: string;
  title: string;
  category: string;
  amount: string;
  amount_num: number;
  priority: string;
  is_confirmed: boolean;
  notes: string;
}

export interface CalendarResponse {
  reference_date: string;
  horizon_days: number;
  end_date: string;
  total_committed_amount: number;
  category_totals: Record<string, number>;
  payments_count: number;
  scheduled_payments: CalendarOutflowItem[];
}

export interface CalibrationPoint {
  predicted: number;
  actual: number;
}

export interface BacktestResponse {
  business_id: string;
  dataset_name: string;
  is_synthetic: boolean;
  evaluation_periods: number;
  band_coverage_pct: number;
  band_coverage_target_pct: number;
  warning_lead_time_days: number;
  false_alarms_ratio: string;
  missed_shortfalls_count: number;
  mean_absolute_error_inr: number;
  mean_absolute_error_formatted: string;
  trust_score: number;
  calibration_curve: CalibrationPoint[];
  methodology_notes: string[];
}



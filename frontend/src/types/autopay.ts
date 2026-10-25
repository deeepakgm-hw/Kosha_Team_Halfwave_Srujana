export type MandateStatus =
  | "pending_authorization"
  | "active"
  | "paused"
  | "revoked"
  | "cancelled"
  | "expired"
  | "failed";

export interface AutopayMandate {
  id: string;
  customer_id: string;
  business_id: string;
  bill_id: string;
  business_name: string;
  customer_name: string;
  bill_reference?: string | null;
  bill_outstanding: number;
  repayment_deadline?: string | null;
  mandate_type: "upi_autopay" | "recurring_card" | "netbanking_enach";
  amount_type: "fixed" | "variable";
  max_amount: number;
  max_amount_paise: number;
  currency: string;
  frequency: string;
  status: MandateStatus;
  effective_date: string;
  expiry_date?: string | null;
  consent_timestamp: string;
  terms_version: string;
  collection_condition: string;
  cancellation_terms: string;
  razorpay_auth_reference?: string | null;
  razorpay_token_id?: string | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  created_at?: string;
}

export interface AutopaySetupResponse {
  mandate_id: string;
  bill_id: string;
  customer_id: string;
  business_id: string;
  business_name: string;
  status: MandateStatus;
  max_amount: number;
  max_amount_paise: number;
  currency: string;
  repayment_deadline?: string | null;
  collection_condition: string;
  cancellation_terms: string;
  terms_version: string;
  razorpay_order_id?: string | null;
  razorpay_customer_id?: string | null;
  razorpay_key_id: string;
  provider_capability: "upi_autopay_ready" | "account_activation_required" | "standard_checkout" | "connection_error" | "sandbox_unconfigured";
  instructions: string;
  failure_reason?: string | null;
}

export interface AutopaySetupPayload {
  bill_id: string;
  explicit_consent: boolean;
  terms_accepted: boolean;
  terms_version?: string;
  max_amount?: number;
  mandate_type?: "upi_autopay" | "recurring_card" | "netbanking_enach";
}

export interface AutopayVerifyPayload {
  mandate_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface ConsentAudit {
  id: string;
  mandate_id: string;
  customer_id: string;
  bill_id: string;
  action: string;
  terms_version: string;
  max_amount: number;
  currency: string;
  timestamp: string;
  notes?: string | null;
}

export type AutopayAttemptStatus =
  | "scheduled"
  | "eligible"
  | "awaiting_notification"
  | "initiated"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "reconciliation_required";

export interface AutopayAttempt {
  id: string;
  mandate_id: string;
  bill_id: string;
  customer_id?: string;
  business_id?: string;
  amount: number;
  amount_paise: number;
  attempt_number: number;
  status: AutopayAttemptStatus | string;
  intended_collection_date?: string | null;
  notification_requirement?: string | null;
  notification_status?: string | null;
  notification_reference?: string | null;
  notification_timestamp?: string | null;
  eligibility_decision?: string | null;
  deferral_reason?: string | null;
  next_retry_at?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  initiation_time: string;
  result_time?: string | null;
  reconciliation_status: string;
}

export interface CollectionCycleTriggerRequest {
  target_date?: string;
  bypass_notification_window?: boolean;
  bill_ids?: string[];
}

export interface CollectionCycleResponse {
  success: boolean;
  message: string;
  cycle_timestamp: string;
  total_bills_evaluated: number;
  eligible_count: number;
  notified_count: number;
  initiated_count: number;
  succeeded_count: number;
  failed_count: number;
  deferred_count?: number;
  reconciliation_required_count: number;
  total_collected_inr: number;
  total_collected_paise: number;
  details: any[];
}

export interface ReconciliationCycleResponse {
  success: boolean;
  reconciliation_run_id: string;
  cycle_timestamp: string;
  total_attempts_audited: number;
  total_bills_audited: number;
  discrepancies_found: number;
  resolved_count: number;
  manual_review_count: number;
  discrepancies: any[];
}

export interface CollectionEngineStatusResponse {
  engine_active: boolean;
  scheduler_enabled: boolean;
  collection_hour_utc: number;
  active_mandates_count: number;
  bills_awaiting_notification: number;
  overdue_eligible_bills: number;
  reconciliation_pending_count: number;
  last_cycle_timestamp?: string | null;
}

export interface BillCollectionEligibilityResponse {
  bill_id: string;
  bill_reference?: string | null;
  is_eligible: boolean;
  decision: string;
  deferral_reason?: string | null;
  outstanding_amount: number;
  collectible_amount: number;
  mandate_id?: string | null;
  mandate_status?: string | null;
  pre_debit_notification_satisfied: boolean;
}

export interface AutopayMandateDetail {
  mandate: AutopayMandate;
  audit_logs: ConsentAudit[];
  attempts: AutopayAttempt[];
}

export interface BillTimelineEvent {
  id: string;
  event_type: string;
  category: "confirmed_financial" | "non_final_state" | "governance";
  title: string;
  description: string;
  timestamp: string;
  amount_inr?: number | null;
  amount_paise?: number | null;
  provider_reference?: string | null;
  is_confirmed: boolean;
}

export interface BillTimelineResponse {
  bill_id: string;
  bill_reference: string;
  shop_name: string;
  customer_name: string;
  purchase_amount: number;
  outstanding_amount: number;
  status: string;
  mandate_status?: string | null;
  events: BillTimelineEvent[];
}

export interface ReconciliationCycleRequest {
  business_id?: string;
  bill_id?: string;
  force_audit_all?: boolean;
}

export interface ReconciliationRecord {
  id: string;
  reconciliation_run_id: string;
  bill_id?: string | null;
  attempt_id?: string | null;
  provider_payment_id?: string | null;
  discrepancy_type: string;
  observed_discrepancy: string;
  provider_status?: string | null;
  internal_status?: string | null;
  resolution_action: string;
  resolution_status: string;
  manual_review_required: boolean;
  amount_paise?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface BusinessAutopayBillItem {
  bill_id: string;
  reference: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string | null;
  purchase_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  agreed_repayment_date?: string | null;
  is_overdue: boolean;
  autopay_status: string;
  mandate_id?: string | null;
  max_amount?: number | null;
  latest_attempt_status?: string | null;
  latest_attempt_result?: string | null;
  next_scheduled_action?: string | null;
}

export interface BusinessAutopayDashboardSummary {
  shop_id: string;
  total_bills: number;
  eligible_bills_count: number;
  awaiting_authorization_count: number;
  active_mandates_count: number;
  overdue_protected_count: number;
  overdue_unprotected_count: number;
  total_protected_outstanding_inr: number;
  total_unprotected_outstanding_inr: number;
  collection_attempts_count: number;
  successful_collections_count: number;
  failed_collections_count: number;
  reconciliation_discrepancies_count: number;
  bills: BusinessAutopayBillItem[];
}

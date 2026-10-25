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

export interface AutopayAttempt {
  id: string;
  mandate_id: string;
  bill_id: string;
  amount: number;
  amount_paise: number;
  attempt_number: number;
  status: "initiated" | "success" | "failed" | "rejected";
  razorpay_payment_id?: string | null;
  initiation_time: string;
  result_time?: string | null;
  failure_reason?: string | null;
  reconciliation_status: string;
}

export interface AutopayMandateDetail {
  mandate: AutopayMandate;
  audit_logs: ConsentAudit[];
  attempts: AutopayAttempt[];
}

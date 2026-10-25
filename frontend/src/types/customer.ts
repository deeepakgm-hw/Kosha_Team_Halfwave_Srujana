export interface CustomerProfile {
  id: string;
  display_name: string;
  phone: string;
  email?: string;
  created_at: string;
}

export interface Shop {
  id: string;
  shop_name: string;
  shop_code: string;
  category: string;
  owner_name: string;
  phone?: string;
  upi_id?: string;
  qr_payload?: string;
  is_verified: boolean;
  status: string;
  created_at: string;
}

export interface ShopQr {
  shop_code: string;
  shop_name: string;
  qr_payload: string;
  qr_svg: string;
  instructions: string;
}

export interface Repayment {
  id: string;
  transaction_id: string;
  amount: number;
  repayment_date: string;
  payment_method: string;
  payment_status: string;
  recorded_by?: string;
  provider_reference?: string;
  notes?: string;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  reference: string;
  customer_id: string;
  shop_id: string;
  shop_name: string;
  shop_code: string;
  description: string;
  purchase_amount: number;
  initial_paid_amount: number;
  outstanding_amount: number;
  transaction_date: string;
  agreed_repayment_date: string;
  status: "upcoming" | "due_today" | "overdue" | "paid";
  created_at: string;
  repayments: Repayment[];
}

export interface ActivityEvent {
  id: string;
  customer_id: string;
  transaction_id?: string;
  event_type: "purchase_recorded" | "partial_payment" | "repayment_completed" | "reminder";
  title: string;
  description: string;
  amount?: number;
  created_at: string;
}

export interface ReminderItem {
  transaction_id: string;
  reference?: string;
  shop_name: string;
  shop_code?: string;
  amount: number;
  due_date: string;
  days_diff?: number;
  urgency: "overdue" | "due_today" | "approaching" | "upcoming" | "completed";
  message: string;
}

export interface CustomerDashboardSummary {
  customer: CustomerProfile;
  total_outstanding: number;
  due_within_7_days: number;
  overdue_amount: number;
  shops_count: number;
  status_message: string;
  upcoming_repayments: CreditTransaction[];
  recent_activity: ActivityEvent[];
  reminders: ReminderItem[];
  total_purchase_amount?: number;
  total_initial_paid?: number;
  total_verified_online_paid?: number;
  total_paid_amount?: number;
  active_bills_count?: number;
  settled_bills_count?: number;
}

export interface CustomerDuesResponse {
  customer?: CustomerProfile;
  total_outstanding: number;
  overdue_amount: number;
  due_today_amount: number;
  upcoming_amount: number;
  paid_amount: number;
  transactions: CreditTransaction[];
  total_purchase_amount?: number;
  total_initial_paid?: number;
  total_verified_online_paid?: number;
}

export interface CreditTransactionCreatePayload {
  shop_code: string;
  description: string;
  purchase_amount: number;
  amount_paid_now: number;
  agreed_repayment_date: string;
}

export interface RepaymentCreatePayload {
  amount: number;
  payment_method?: string;
  notes?: string;
}

// =========================================================================
// Shopkeeper Types
// =========================================================================

export interface ShopkeeperSummary {
  shop: Shop;
  total_customer_receivables: number;
  collected_today: number;
  due_in_7_days: number;
  overdue_receivables: number;
  customers_with_balance_count: number;
  total_transactions_count: number;
  total_billed_amount?: number;
  total_cash_collected?: number;
  total_online_verified?: number;
  settled_transactions_count?: number;
  active_transactions_count?: number;
}

export interface ShopkeeperTransaction {
  id: string;
  reference: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  shop_id: string;
  shop_name: string;
  shop_code: string;
  description: string;
  purchase_amount: number;
  initial_paid_amount: number;
  outstanding_amount: number;
  transaction_date: string;
  agreed_repayment_date: string;
  status: "upcoming" | "due_today" | "overdue" | "paid";
  created_at: string;
  repayments: Repayment[];
}

export interface ShopkeeperRepaymentCreatePayload {
  amount: number;
  payment_method: string;
  notes?: string;
}

export interface PaymentGatewayStatus {
  is_configured: boolean;
  provider_name: string;
  supported_methods: string[];
  is_sandbox: boolean;
  instructions: string;
}

// =========================================================================
// Razorpay UPI Integration Types
// =========================================================================

export interface RazorpayConfig {
  key_id: string;
  mode: "test" | "live";
  is_test_mode?: boolean;
  is_configured?: boolean;
  has_live_credentials?: boolean;
  upi_flow?: string;
  merchant_name: string;
  upi_vpa: string;
  currency?: string;
  upi_flow_enabled?: boolean;
}

export interface ShopkeeperFinancialSummary {
  shop_id: string;
  shop_name: string;
  total_billed_volume: number;
  counter_cash_paid: number;
  razorpay_verified_collections: number;
  total_collected: number;
  remaining_customer_dues: number;
  active_bills_count: number;
  settled_bills_count: number;
  total_bills_count: number;
  settlement_rate_percentage: number;
  collections_settlement_percentage: number;
  unresolved_discrepancy: number;
  is_reconciled: boolean;
}

export interface RazorpayPaymentRequest {
  id: string;
  bill_id: string;
  customer_id: string;
  business_id?: string;
  shop_id?: string;
  amount_paise: number;
  amount_inr: number;
  currency: string;
  razorpay_order_id?: string;
  gateway_order_id?: string;
  gateway_payment_link?: string;
  razorpay_payment_link_id?: string;
  razorpay_qr_id?: string;
  upi_qr_payload?: string;
  upi_qr_svg?: string;
  qr_image_url?: string;
  short_url?: string;
  is_partial_allowed?: boolean;
  status: "active" | "pending_verification" | "partially_paid" | "paid" | "failed" | "expired" | "cancelled";
  failure_reason?: string;
  idempotency_key?: string;
  expires_at?: string;
  created_at: string;
  is_test_mode?: boolean;
  key_id?: string;
}

export interface RazorpayPaymentVerification {
  id: string;
  payment_request_id?: string;
  bill_id: string;
  razorpay_payment_id: string;
  payment_id?: string;
  razorpay_order_id?: string;
  order_id?: string;
  signature?: string;
  amount_paise: number;
  amount_inr: number;
  currency: string;
  payment_method: string;
  method?: string;
  vpa?: string;
  status: string;
  verification_source?: string;
  verified_by?: string;
  verified_at: string;
}

export interface BillLineItem {
  name: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  total?: number;
}

export interface CustomerRegisterPayload {
  display_name: string;
  phone: string;
  email?: string;
}

export interface BillPaymentHistory {
  bill_id: string;
  bill_reference: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  shop_id?: string;
  shop_code?: string;
  shop_name: string;
  description: string;
  notes?: string;
  line_items?: BillLineItem[];
  total_amount: number;
  initial_manual_paid: number;
  verified_razorpay_paid: number;
  outstanding_amount: number;
  created_at?: string;
  agreed_repayment_date: string;
  status: "upcoming" | "due_today" | "overdue" | "paid";
  active_payment_request?: RazorpayPaymentRequest | null;
  payment_requests?: RazorpayPaymentRequest[];
  verified_payments: RazorpayPaymentVerification[];
  all_repayments?: Repayment[];

  // Optional aliases for interoperability
  id?: string;
  bill_number?: string;
  initial_paid_amount?: number;
  total_verified_payments?: number;
  payment_status?: "unpaid" | "partially_paid" | "paid" | "failed" | "pending_verification";
  purchase_date?: string;
  repayment_due_date?: string;
}

export interface ShopkeeperBillCreatePayload {
  customer_id?: string;
  new_customer?: CustomerRegisterPayload;
  description: string;
  total_amount: number;
  initial_payment_amount?: number;
  initial_manual_paid?: number;
  initial_payment_method?: "cash" | "razorpay_upi" | "none";
  line_items?: BillLineItem[];
  notes?: string;
  agreed_repayment_date: string;
  generate_payment_request?: boolean;
  idempotency_key?: string;
}

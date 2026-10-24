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
}

export interface CustomerDuesResponse {
  total_outstanding: number;
  overdue_amount: number;
  due_today_amount: number;
  upcoming_amount: number;
  paid_amount: number;
  transactions: CreditTransaction[];
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

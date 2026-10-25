import { ApiHealthResponse } from "../types/api";
import {
  AutopayMandate,
  AutopayMandateDetail,
  AutopaySetupPayload,
  AutopaySetupResponse,
  AutopayVerifyPayload,
} from "../types/autopay";
import {
  AuthResponse,
  GoogleAuthPayload,
  LoginPayload,
  MessageResponse,
  RegisterBusinessPayload,
  RegisterCustomerPayload,
  UserProfile,
} from "../types/auth";
import {
  ActionRankingResponse,
  BacktestResponse,
  BankAccount,
  BankTransaction,
  BusinessProfile,
  BusinessStateSummary,
  CalendarResponse,
  CsvImportResult,
  CustomerInvoice,
  ForecastRequest,
  ForecastResponse,
  ReceivablesLawResponse,
  ScenarioSimulationRequest,
  ScenarioSimulationResponse,
  VendorBill,
} from "../types/cashflow";
import {
  ActivityEvent,
  BillPaymentHistory,
  CreditTransaction,
  CreditTransactionCreatePayload,
  CustomerDashboardSummary,
  CustomerDuesResponse,
  CustomerProfile,
  PaymentGatewayStatus,
  RazorpayConfig,
  RazorpayPaymentRequest,
  ReminderItem,
  RepaymentCreatePayload,
  Shop,
  ShopQr,
  ShopkeeperBillCreatePayload,
  ShopkeeperFinancialSummary,
  ShopkeeperRepaymentCreatePayload,
  ShopkeeperSummary,
  ShopkeeperTransaction,
} from "../types/customer";

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return "http://localhost:8000/api";
  }
  return "/api";
};

const BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Formats API errors into user-friendly, actionable error messages.
 * Extracts Pydantic validation field details, HTTPException strings, or AppException messages.
 */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as Record<string, unknown> | undefined;
    if (data) {
      // 1. Kosha AppException envelope: { error: { message: "...", code: "..." } }
      if (data.error && typeof data.error === "object") {
        const errObj = data.error as Record<string, unknown>;
        if (typeof errObj.message === "string") {
          return errObj.message;
        }
      }
      // 2. FastAPI / Pydantic validation errors array: { detail: [ { loc: [...], msg: "..." } ] }
      if (Array.isArray(data.detail)) {
        const errorMsgs = data.detail.map((item: any) => {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : item.loc;
          const msg = item.msg || "Invalid value";
          return field ? `${field}: ${msg}` : msg;
        });
        return `Validation error: ${errorMsgs.join("; ")}`;
      }
      // 3. FastAPI HTTPException: { detail: "..." }
      if (typeof data.detail === "string") {
        return data.detail;
      }
      // 4. Custom AppException: { message: "...", code: "..." }
      if (typeof data.message === "string") {
        return data.message;
      }
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred.";
}

/**
 * Standard fetch wrapper with centralized error handling and JSON parsing.
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${normalizedEndpoint}`;

  const defaultHeaders: HeadersInit = {
    Accept: "application/json",
  };

  // Attach bearer token if authenticated
  const token = typeof window !== "undefined" ? localStorage.getItem("kosha_auth_token") : null;
  if (token) {
    (defaultHeaders as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  // If not FormData, set application/json
  if (!(options.body instanceof FormData)) {
    (defaultHeaders as Record<string, string>)["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    throw new ApiError(
      response.status,
      `API error [${response.status}]: ${response.statusText}`,
      errorData
    );
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  // Health
  async getHealth(): Promise<ApiHealthResponse> {
    return fetchApi<ApiHealthResponse>("/health");
  },

  // Forecast
  async getForecast(request?: ForecastRequest): Promise<ForecastResponse> {
    return fetchApi<ForecastResponse>("/forecast", {
      method: "POST",
      body: JSON.stringify(request || {}),
    });
  },

  // What-If Scenario Simulation
  async simulateScenario(request?: ScenarioSimulationRequest): Promise<ScenarioSimulationResponse> {
    return fetchApi<ScenarioSimulationResponse>("/simulate", {
      method: "POST",
      body: JSON.stringify(request || {}),
    });
  },

  // Businesses
  async listBusinesses(includeDemo = true): Promise<BusinessProfile[]> {
    return fetchApi<BusinessProfile[]>(`/businesses?include_demo=${includeDemo}`);
  },

  async getBusiness(businessId: string): Promise<BusinessProfile> {
    return fetchApi<BusinessProfile>(`/businesses/${businessId}`);
  },

  async getBusinessState(businessId: string): Promise<BusinessStateSummary> {
    return fetchApi<BusinessStateSummary>(`/businesses/${businessId}/state`);
  },

  async createBusiness(data: Partial<BusinessProfile>): Promise<BusinessProfile> {
    return fetchApi<BusinessProfile>("/businesses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Bank Accounts
  async listBankAccounts(businessId: string): Promise<BankAccount[]> {
    return fetchApi<BankAccount[]>(`/businesses/${businessId}/accounts`);
  },

  async createBankAccount(businessId: string, data: Partial<BankAccount>): Promise<BankAccount> {
    return fetchApi<BankAccount>(`/businesses/${businessId}/accounts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // CSV Statement Import & Transactions
  async importStatementCsv(
    businessId: string,
    file: File,
    bankAccountId?: string,
    amountSignMode = "standard",
    openingBalance?: number,
    openingBalanceDate?: string
  ): Promise<CsvImportResult> {
    const formData = new FormData();
    formData.append("business_id", businessId);
    if (bankAccountId) formData.append("bank_account_id", bankAccountId);
    formData.append("amount_sign_mode", amountSignMode);
    formData.append("file", file);
    if (openingBalance !== undefined && !isNaN(openingBalance)) {
      formData.append("opening_balance", openingBalance.toString());
    }
    if (openingBalanceDate && openingBalanceDate.trim() !== "") {
      formData.append("opening_balance_date", openingBalanceDate.trim());
    }

    return fetchApi<CsvImportResult>("/statements/import-csv", {
      method: "POST",
      body: formData,
    });
  },

  async listTransactions(businessId: string, limit = 100): Promise<BankTransaction[]> {
    return fetchApi<BankTransaction[]>(`/transactions?business_id=${businessId}&limit=${limit}`);
  },

  // Invoices
  async listInvoices(businessId: string, status?: string): Promise<CustomerInvoice[]> {
    const q = status ? `&status=${status}` : "";
    return fetchApi<CustomerInvoice[]>(`/invoices?business_id=${businessId}${q}`);
  },

  async createInvoice(businessId: string, data: Record<string, unknown>): Promise<CustomerInvoice> {
    return fetchApi<CustomerInvoice>(`/invoices?business_id=${businessId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async recordInvoicePayment(invoiceId: string, data: Record<string, unknown>): Promise<unknown> {
    return fetchApi(`/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Bills
  async listBills(businessId: string, status?: string): Promise<VendorBill[]> {
    const q = status ? `&status=${status}` : "";
    return fetchApi<VendorBill[]>(`/bills?business_id=${businessId}${q}`);
  },

  async createBill(businessId: string, data: Record<string, unknown>): Promise<VendorBill> {
    return fetchApi<VendorBill>(`/bills?business_id=${businessId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async recordBillPayment(billId: string, data: Record<string, unknown>): Promise<unknown> {
    return fetchApi(`/bills/${billId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Supporting Capabilities: Actions, Receivables, Calendar, Backtest
  async getRankedActions(request?: {
    business_id?: string;
    shortfall_amount?: number;
    days_until_shortfall?: number;
    baseline_risk_pct?: number;
  }): Promise<ActionRankingResponse> {
    return fetchApi<ActionRankingResponse>("/actions/rank", {
      method: "POST",
      body: JSON.stringify(request || {}),
    });
  },

  async getReceivablesLaw(businessId = "apex_precision_mfg", rbiBankRate = 0.065): Promise<ReceivablesLawResponse> {
    return fetchApi<ReceivablesLawResponse>(`/receivables/law?business_id=${businessId}&rbi_bank_rate=${rbiBankRate}`);
  },

  async getCalendarOutflows(businessId = "apex_precision_mfg", windowDays = 42): Promise<CalendarResponse> {
    return fetchApi<CalendarResponse>(`/calendar?business_id=${businessId}&window_days=${windowDays}`);
  },

  async getBacktestReliability(businessId = "apex_precision_mfg", evaluationPeriods = 12): Promise<BacktestResponse> {
    return fetchApi<BacktestResponse>(`/backtest?business_id=${businessId}&evaluation_periods=${evaluationPeriods}`);
  },

  // Customer Experience Endpoints
  async getCustomerDashboard(customerId = "cust_rahul_01"): Promise<CustomerDashboardSummary> {
    return fetchApi<CustomerDashboardSummary>(`/customer/dashboard?customer_id=${customerId}`);
  },

  async getCustomerDues(customerId = "cust_rahul_01", status?: string): Promise<CustomerDuesResponse> {
    const q = status ? `&status=${status}` : "";
    return fetchApi<CustomerDuesResponse>(`/customer/dues?customer_id=${customerId}${q}`);
  },

  async getCustomerTransaction(transactionId: string, customerId = "cust_rahul_01"): Promise<CreditTransaction> {
    return fetchApi<CreditTransaction>(`/customer/transactions/${transactionId}?customer_id=${customerId}`);
  },

  async createCreditTransaction(
    data: CreditTransactionCreatePayload,
    customerId = "cust_rahul_01"
  ): Promise<CreditTransaction> {
    return fetchApi<CreditTransaction>(`/customer/transactions?customer_id=${customerId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async recordCustomerRepayment(
    transactionId: string,
    data: RepaymentCreatePayload,
    customerId = "cust_rahul_01"
  ): Promise<CreditTransaction> {
    return fetchApi<CreditTransaction>(`/customer/transactions/${transactionId}/repayments?customer_id=${customerId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async listShops(): Promise<Shop[]> {
    return fetchApi<Shop[]>("/shops");
  },

  async getShopByCode(shopCode: string): Promise<Shop> {
    return fetchApi<Shop>(`/shops/${encodeURIComponent(shopCode.trim())}`);
  },

  async getCustomerActivity(customerId = "cust_rahul_01", limit = 20): Promise<ActivityEvent[]> {
    return fetchApi<ActivityEvent[]>(`/customer/activity?customer_id=${customerId}&limit=${limit}`);
  },

  async getCustomerReminders(customerId = "cust_rahul_01"): Promise<ReminderItem[]> {
    return fetchApi<ReminderItem[]>(`/customer/reminders?customer_id=${customerId}`);
  },

  async getShopQr(shopCode: string): Promise<ShopQr> {
    return fetchApi<ShopQr>(`/shops/${encodeURIComponent(shopCode.trim())}/qr`);
  },

  // Shopkeeper APIs
  async getShopkeeperShop(shopId = "shop_apex_01"): Promise<Shop> {
    return fetchApi<Shop>(`/shopkeeper/shop?shop_id=${shopId}`);
  },

  async getShopkeeperSummary(shopId = "shop_apex_01"): Promise<ShopkeeperSummary> {
    return fetchApi<ShopkeeperSummary>(`/shopkeeper/shop/summary?shop_id=${shopId}`);
  },

  async getShopkeeperFinancialSummary(shopId = "shop_apex_01"): Promise<ShopkeeperFinancialSummary> {
    return fetchApi<ShopkeeperFinancialSummary>(`/shopkeeper/financial-summary?shop_id=${encodeURIComponent(shopId)}`);
  },

  async getShopkeeperTransactions(
    shopId = "shop_apex_01",
    status?: string,
    search?: string
  ): Promise<ShopkeeperTransaction[]> {
    let url = `/shopkeeper/shop/transactions?shop_id=${shopId}`;
    if (status && status !== "all") url += `&status=${status}`;
    if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    return fetchApi<ShopkeeperTransaction[]>(url);
  },

  async recordShopkeeperRepayment(
    transactionId: string,
    data: ShopkeeperRepaymentCreatePayload,
    shopId = "shop_apex_01"
  ): Promise<ShopkeeperTransaction> {
    return fetchApi<ShopkeeperTransaction>(
      `/shopkeeper/transactions/${transactionId}/repayments?shop_id=${shopId}`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  // Payment Gateway Boundary
  async getPaymentGatewayStatus(): Promise<PaymentGatewayStatus> {
    return fetchApi<PaymentGatewayStatus>("/payment-gateway/status");
  },

  // Razorpay UPI Integration Endpoints
  async getRazorpayConfig(): Promise<RazorpayConfig> {
    return fetchApi<RazorpayConfig>("/payment-gateway/config");
  },

  async createRazorpayPaymentRequest(params: {
    billId?: string;
    bill_id?: string;
    amountPaise?: number;
    amount_paise?: number;
    partialAmount?: number;
    partial_amount?: number;
    customerId?: string;
    customer_id?: string;
    businessId?: string;
    business_id?: string;
    idempotencyKey?: string;
    idempotency_key?: string;
  }): Promise<RazorpayPaymentRequest> {
    const custId = params.customerId || params.customer_id;
    const bizId = params.businessId || params.business_id;
    const qParts: string[] = [];
    if (custId) qParts.push(`customer_id=${encodeURIComponent(custId)}`);
    if (bizId) qParts.push(`business_id=${encodeURIComponent(bizId)}`);
    const q = qParts.length > 0 ? `?${qParts.join("&")}` : "";
    return fetchApi<RazorpayPaymentRequest>(`/payment-gateway/requests${q}`, {
      method: "POST",
      body: JSON.stringify({
        bill_id: params.billId || params.bill_id,
        amount_paise: params.amountPaise ?? params.amount_paise,
        partial_amount: params.partialAmount ?? params.partial_amount,
        idempotency_key: params.idempotencyKey || params.idempotency_key,
      }),
    });
  },

  async getRazorpayPaymentRequest(requestId: string): Promise<RazorpayPaymentRequest> {
    return fetchApi<RazorpayPaymentRequest>(`/payment-gateway/requests/${requestId}`);
  },

  async regenerateRazorpayPaymentRequest(requestId: string, customerId?: string): Promise<RazorpayPaymentRequest> {
    const q = customerId ? `?customer_id=${customerId}` : "";
    return fetchApi<RazorpayPaymentRequest>(`/payment-gateway/requests/${requestId}/regenerate${q}`, {
      method: "POST",
    });
  },

  async syncPaymentRequestStatus(requestId: string): Promise<{
    request_id: string;
    bill_id: string;
    status: string;
    outcome: "success" | "failed" | "awaiting" | "attempt_failed";
    verified: boolean;
    payment_id?: string;
    amount_inr?: number;
    new_outstanding?: number;
    message?: string;
    reason?: string;
  }> {
    return fetchApi(`/payment-gateway/requests/${requestId}/sync`, {
      method: "POST",
    });
  },

  async simulatePaymentRecognition(
    requestId: string,
    outcome: "success" | "failed",
    reason?: string
  ): Promise<{
    request_id: string;
    bill_id: string;
    status: string;
    outcome: string;
    verified: boolean;
    payment_id?: string;
    amount_inr?: number;
    new_outstanding?: number;
    message?: string;
    reason?: string;
  }> {
    return fetchApi(`/payment-gateway/requests/${requestId}/simulate-recognition`, {
      method: "POST",
      body: JSON.stringify({ outcome, reason }),
    });
  },

  async verifyRazorpayPayment(data: {
    transaction_id: string;
    order_id: string;
    payment_id: string;
    signature?: string;
    customerId?: string;
  }): Promise<{ verified: boolean; payment_id: string; amount_inr: number; status: string }> {
    const q = data.customerId ? `?customer_id=${data.customerId}` : "";
    return fetchApi(`/payment-gateway/verify${q}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getBillPaymentHistory(billId: string, customerId?: string, businessId?: string): Promise<BillPaymentHistory> {
    let url = `/payment-gateway/bills/${billId}/history`;
    const params = new URLSearchParams();
    if (customerId) params.append("customer_id", customerId);
    if (businessId) params.append("business_id", businessId);
    if (params.toString()) url += `?${params.toString()}`;
    return fetchApi<BillPaymentHistory>(url);
  },

  // Shopkeeper Bill Creation & Management
  async listShopkeeperCustomers(search?: string): Promise<CustomerProfile[]> {
    let url = "/shopkeeper/customers";
    if (search && search.trim()) url += `?search=${encodeURIComponent(search.trim())}`;
    return fetchApi<CustomerProfile[]>(url);
  },

  async registerShopkeeperCustomer(payload: { display_name: string; phone: string; email?: string }): Promise<CustomerProfile> {
    return fetchApi<CustomerProfile>("/shopkeeper/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createShopkeeperBill(payload: ShopkeeperBillCreatePayload, shopId = "shop_apex_01"): Promise<BillPaymentHistory> {
    return fetchApi<BillPaymentHistory>(`/shopkeeper/bills?shop_id=${shopId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getShopkeeperBill(billId: string, shopId = "shop_apex_01"): Promise<BillPaymentHistory> {
    return fetchApi<BillPaymentHistory>(`/shopkeeper/bills/${billId}?shop_id=${shopId}`);
  },

  async updateBillRepaymentDate(
    billId: string,
    agreedRepaymentDate: string,
    notes?: string,
    shopId = "shop_apex_01"
  ): Promise<BillPaymentHistory> {
    return fetchApi<BillPaymentHistory>(`/shopkeeper/bills/${billId}/repayment-date?shop_id=${shopId}`, {
      method: "PATCH",
      body: JSON.stringify({ agreed_repayment_date: agreedRepaymentDate, notes }),
    });
  },

  async recordBillCashReceipt(
    billId: string,
    amount: number,
    notes?: string,
    shopId = "shop_apex_01"
  ): Promise<BillPaymentHistory> {
    return fetchApi<BillPaymentHistory>(`/shopkeeper/bills/${billId}/cash-receipt?shop_id=${shopId}`, {
      method: "POST",
      body: JSON.stringify({ amount, notes }),
    });
  },

  async listShopkeeperBills(shopId = "shop_apex_01", status?: string, search?: string): Promise<BillPaymentHistory[]> {
    let url = `/shopkeeper/bills?shop_id=${shopId}`;
    if (status && status !== "all") url += `&status=${status}`;
    if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    return fetchApi<BillPaymentHistory[]>(url);
  },

  async listCustomerBills(customerId = "cust_rahul_01", status?: string): Promise<BillPaymentHistory[]> {
    let url = `/customer/bills?customer_id=${customerId}`;
    if (status && status !== "all") url += `&status=${status}`;
    return fetchApi<BillPaymentHistory[]>(url);
  },

  async getCustomerBill(billId: string, customerId = "cust_rahul_01"): Promise<BillPaymentHistory> {
    return fetchApi<BillPaymentHistory>(`/customer/bills/${billId}?customer_id=${customerId}`);
  },

  async createCustomerBillPaymentRequest(
    billId: string,
    partialAmount?: number,
    customerId = "cust_rahul_01"
  ): Promise<RazorpayPaymentRequest> {
    let url = `/customer/bills/${billId}/payment-request?customer_id=${customerId}`;
    if (partialAmount && partialAmount > 0) url += `&partial_amount=${partialAmount}`;
    return fetchApi<RazorpayPaymentRequest>(url, {
      method: "POST",
    });
  },

  // ---------------------------------------------------------------------------
  // Real Authentication API
  // ---------------------------------------------------------------------------
  async registerCustomer(payload: RegisterCustomerPayload): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/auth/register/customer", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async registerBusiness(payload: RegisterBusinessPayload): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/auth/register/business", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async loginWithGoogle(payload: GoogleAuthPayload): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getCurrentUser(): Promise<UserProfile> {
    return fetchApi<UserProfile>("/auth/me");
  },

  async logout(): Promise<MessageResponse> {
    return fetchApi<MessageResponse>("/auth/logout", {
      method: "POST",
    });
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    return fetchApi<MessageResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(payload: { token: string; new_password: string; confirm_password: string }): Promise<MessageResponse> {
    return fetchApi<MessageResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ---------------------------------------------------------------------------
  // AutoPay & Recurring Mandates API
  // ---------------------------------------------------------------------------
  async setupAutopayMandate(payload: AutopaySetupPayload, customerId?: string): Promise<AutopaySetupResponse> {
    const q = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
    return fetchApi<AutopaySetupResponse>(`/autopay/mandates/setup${q}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async verifyAutopayMandate(payload: AutopayVerifyPayload, customerId?: string): Promise<AutopayMandate> {
    const q = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
    return fetchApi<AutopayMandate>(`/autopay/mandates/verify${q}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getAutopayMandateByBill(
    billId: string,
    customerId?: string,
    businessId?: string
  ): Promise<AutopayMandateDetail | null> {
    const params = new URLSearchParams();
    if (customerId) params.append("customer_id", customerId);
    if (businessId) params.append("business_id", businessId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return fetchApi<AutopayMandateDetail | null>(`/autopay/mandates/bill/${billId}${qs}`);
  },

  async listCustomerAutopayMandates(customerId?: string): Promise<AutopayMandate[]> {
    const q = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
    return fetchApi<AutopayMandate[]>(`/autopay/mandates/customer${q}`);
  },

  async listBusinessAutopayMandates(businessId?: string): Promise<AutopayMandate[]> {
    const q = businessId ? `?business_id=${encodeURIComponent(businessId)}` : "";
    return fetchApi<AutopayMandate[]>(`/autopay/mandates/business${q}`);
  },

  async pauseAutopayMandate(
    mandateId: string,
    customerId?: string,
    businessId?: string
  ): Promise<AutopayMandate> {
    const params = new URLSearchParams();
    if (customerId) params.append("customer_id", customerId);
    if (businessId) params.append("business_id", businessId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return fetchApi<AutopayMandate>(`/autopay/mandates/${mandateId}/pause${qs}`, {
      method: "POST",
    });
  },

  async resumeAutopayMandate(
    mandateId: string,
    customerId?: string,
    businessId?: string
  ): Promise<AutopayMandate> {
    const params = new URLSearchParams();
    if (customerId) params.append("customer_id", customerId);
    if (businessId) params.append("business_id", businessId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return fetchApi<AutopayMandate>(`/autopay/mandates/${mandateId}/resume${qs}`, {
      method: "POST",
    });
  },

  async revokeAutopayMandate(mandateId: string, customerId?: string): Promise<AutopayMandate> {
    const q = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
    return fetchApi<AutopayMandate>(`/autopay/mandates/${mandateId}/revoke${q}`, {
      method: "POST",
    });
  },
};

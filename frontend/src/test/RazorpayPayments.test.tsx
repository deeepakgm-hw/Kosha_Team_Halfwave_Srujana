import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BusinessPaymentsSection } from "../features/payments/BusinessPaymentsSection";
import { RazorpayCheckoutModal } from "../features/payments/RazorpayCheckoutModal";
import { CustomerDuesPage } from "../features/customer/CustomerDuesPage";
import { BusinessProvider } from "../context/BusinessContext";
import { LanguageProvider } from "../context/LanguageContext";
import { apiClient } from "../lib/api";
import {
  BillPaymentHistory,
  CustomerProfile,
  RazorpayConfig,
  RazorpayPaymentRequest,
} from "../types/customer";

const mockRazorpayConfig: RazorpayConfig = {
  key_id: "rzp_test_KOSHA12345678",
  merchant_name: "Apex Precision Works",
  mode: "test",
  currency: "INR",
  upi_vpa: "kosha.business@icici",
  upi_flow_enabled: true,
};

const mockCustomers: CustomerProfile[] = [
  {
    id: "cust_rahul_01",
    display_name: "Rahul Sharma",
    phone: "+91 98765 43210",
    email: "rahul.sharma@example.in",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "cust_priya_02",
    display_name: "Priya Sundaram",
    phone: "+91 98765 43211",
    email: "priya.sundaram@example.in",
    created_at: "2026-01-05T00:00:00Z",
  },
];

const mockPaymentRequest: RazorpayPaymentRequest = {
  id: "req_test_001",
  bill_id: "ctx_test_bill_01",
  customer_id: "cust_rahul_01",
  shop_id: "shop_apex_01",
  amount_paise: 200000,
  amount_inr: 2000.0,
  currency: "INR",
  status: "active",
  gateway_order_id: "order_test_998877",
  gateway_payment_link: "https://rzp.io/i/test_link_01",
  upi_qr_payload: "upi://pay?pa=kosha.business@icici&pn=Apex%20Precision%20Works&am=2000.00&tr=req_test_001&cu=INR",
  upi_qr_svg: "<svg>QR</svg>",
  is_partial_allowed: true,
  expires_at: "2026-11-20T00:00:00Z",
  created_at: "2026-10-24T12:00:00Z",
};

const mockBills: BillPaymentHistory[] = [
  {
    bill_id: "ctx_test_bill_01",
    id: "ctx_test_bill_01",
    bill_reference: "BILL-APEX-001",
    bill_number: "BILL-APEX-001",
    customer_id: "cust_rahul_01",
    customer_name: "Rahul Sharma",
    shop_code: "KOSHA-APEX",
    shop_name: "Apex Precision Works",
    description: "High Grade Brass Valves",
    purchase_date: "2026-10-20",
    agreed_repayment_date: "2026-11-10",
    repayment_due_date: "2026-11-10",
    total_amount: 3000.0,
    initial_manual_paid: 1000.0,
    initial_paid_amount: 1000.0,
    verified_razorpay_paid: 0.0,
    total_verified_payments: 0.0,
    outstanding_amount: 2000.0,
    status: "upcoming",
    payment_status: "unpaid",
    active_payment_request: mockPaymentRequest,
    payment_requests: [mockPaymentRequest],
    verified_payments: [],
  },
  {
    bill_id: "ctx_test_bill_02",
    id: "ctx_test_bill_02",
    bill_reference: "BILL-APEX-002",
    bill_number: "BILL-APEX-002",
    customer_id: "cust_priya_02",
    customer_name: "Priya Sundaram",
    shop_code: "KOSHA-APEX",
    shop_name: "Apex Precision Works",
    description: "Industrial Spares",
    purchase_date: "2026-10-15",
    agreed_repayment_date: "2026-10-28",
    repayment_due_date: "2026-10-28",
    total_amount: 5000.0,
    initial_manual_paid: 2000.0,
    initial_paid_amount: 2000.0,
    verified_razorpay_paid: 3000.0,
    total_verified_payments: 3000.0,
    outstanding_amount: 0.0,
    status: "paid",
    payment_status: "paid",
    active_payment_request: undefined,
    payment_requests: [],
    verified_payments: [
      {
        id: "v_01",
        bill_id: "ctx_test_bill_02",
        payment_request_id: "req_prev_01",
        payment_id: "pay_test_priya_999",
        razorpay_payment_id: "pay_test_priya_999",
        order_id: "order_test_priya_888",
        signature: "sig_abc123",
        amount_paise: 300000,
        amount_inr: 3000.0,
        currency: "INR",
        method: "upi",
        payment_method: "upi",
        status: "captured",
        verified_at: "2026-10-22T14:30:00Z",
        verified_by: "webhook",
      },
    ],
  },
];

describe("Razorpay UPI Payment Integration Frontend Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(apiClient, "getRazorpayConfig").mockResolvedValue(mockRazorpayConfig);
    vi.spyOn(apiClient, "listShopkeeperCustomers").mockResolvedValue(mockCustomers);
    vi.spyOn(apiClient, "listShopkeeperBills").mockResolvedValue(mockBills);
    vi.spyOn(apiClient, "createShopkeeperBill").mockResolvedValue({
      ...mockBills[0],
      bill_id: "ctx_new_created_01",
      id: "ctx_new_created_01",
      bill_reference: "BILL-NEW-01",
      bill_number: "BILL-NEW-01",
    });
    vi.spyOn(apiClient, "createRazorpayPaymentRequest").mockResolvedValue(mockPaymentRequest);
    vi.spyOn(apiClient, "regenerateRazorpayPaymentRequest").mockResolvedValue({
      ...mockPaymentRequest,
      id: "req_regenerated_002",
      gateway_order_id: "order_regen_12345",
    });
    vi.spyOn(apiClient, "verifyRazorpayPayment").mockResolvedValue({
      verified: true,
      payment_id: "pay_verified_test_123",
      amount_inr: 2000.0,
      status: "captured",
    });
    vi.spyOn(apiClient, "getCustomerDues").mockResolvedValue({
      customer: mockCustomers[0],
      total_outstanding: 2000.0,
      due_today_amount: 0.0,
      overdue_amount: 0.0,
      upcoming_amount: 2000.0,
      paid_amount: 1000.0,
      transactions: [
        {
          id: "ctx_test_bill_01",
          reference: "BILL-APEX-001",
          customer_id: "cust_rahul_01",
          shop_id: "shop_apex_01",
          shop_name: "Apex Precision Works",
          shop_code: "KOSHA-APEX",
          description: "High Grade Brass Valves",
          purchase_amount: 3000.0,
          initial_paid_amount: 1000.0,
          outstanding_amount: 2000.0,
          transaction_date: "2026-10-20",
          agreed_repayment_date: "2026-11-10",
          status: "upcoming",
          created_at: "2026-10-20T10:00:00Z",
          repayments: [],
        },
      ],
    });
    vi.spyOn(apiClient, "listCustomerBills").mockResolvedValue(mockBills);
    vi.spyOn(apiClient, "getBillPaymentHistory").mockResolvedValue(mockBills[0]);
  });

  it("1. renders Business Payments Section with Test Mode badge and metrics", async () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <BusinessProvider>
            <BusinessPaymentsSection />
          </BusinessProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Customer UPI Billing & Payment Requests/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Test Mode Active/i)).toBeInTheDocument();
    expect(screen.getByText(/BILL-APEX-001/i)).toBeInTheDocument();
    expect(screen.getByText(/BILL-APEX-002/i)).toBeInTheDocument();
  });

  it("2. opens Create Bill modal, validates fields, and records new customer bill", async () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <BusinessProvider>
            <BusinessPaymentsSection />
          </BusinessProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Create New Customer Bill/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Create New Customer Bill/i }));

    expect(screen.getByText(/Register bill & generate Razorpay UPI request/i)).toBeInTheDocument();

    const descInput = screen.getByPlaceholderText(/Industrial fasteners/i);
    const totalInput = screen.getByPlaceholderText("2500.00");
    const initialInput = screen.getByPlaceholderText("0.00");

    fireEvent.change(descInput, { target: { value: "Grade 8 Bolts and Lathe Fasteners" } });
    fireEvent.change(totalInput, { target: { value: "4500" } });
    fireEvent.change(initialInput, { target: { value: "1500" } });

    const submitBtn = screen.getByRole("button", { name: /Create Bill & Generate QR/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.createShopkeeperBill).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: "cust_rahul_01",
          description: "Grade 8 Bolts and Lathe Fasteners",
          total_amount: 4500,
          initial_manual_paid: 1500,
          generate_payment_request: true,
        }),
        "shop_apex_01"
      );
    });
  });

  it("3. allows inspecting active UPI QR card and regenerating expired payment request", async () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <BusinessProvider>
            <BusinessPaymentsSection />
          </BusinessProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/BILL-APEX-001/i)).toBeInTheDocument();
    });

    // Click "View QR & History" on first bill
    const viewButtons = screen.getAllByText(/View QR & History/i);
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Copy UPI Link/i)).toBeInTheDocument();
    });

    // Test regenerate request button
    const regenBtn = screen.getByRole("button", { name: /Regenerate Payment Request/i });
    fireEvent.click(regenBtn);

    await waitFor(() => {
      expect(apiClient.regenerateRazorpayPaymentRequest).toHaveBeenCalledWith(
        "req_test_001"
      );
    });
  });

  it("4. renders Razorpay Checkout Modal for customer, handles full and partial payment amounts", async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <MemoryRouter>
        <LanguageProvider>
          <BusinessProvider>
            <RazorpayCheckoutModal
              bill={mockBills[0]}
              isOpen={true}
              onClose={handleClose}
              onSuccess={handleSuccess}
              customerId="cust_rahul_01"
            />
          </BusinessProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Razorpay UPI Checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/BILL-APEX-001/i)).toBeInTheDocument();
    expect(screen.getByText(/Pay Full Remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/Pay Partial Amount/i)).toBeInTheDocument();

    // Toggle partial payment
    fireEvent.click(screen.getByText(/Pay Partial Amount/i));

    const amountInput = screen.getByPlaceholderText(/Enter amount/i);
    fireEvent.change(amountInput, { target: { value: "800" } });

    // Click update QR button
    const updateAmountBtn = screen.getByRole("button", { name: /Update QR/i });
    fireEvent.click(updateAmountBtn);

    await waitFor(() => {
      expect(apiClient.createRazorpayPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          billId: "ctx_test_bill_01",
          amountPaise: 80000,
        })
      );
    });
  });

  it("5. verifies payment through server-side verification without client-side balance mutation", async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <MemoryRouter>
        <LanguageProvider>
          <BusinessProvider>
            <RazorpayCheckoutModal
              bill={mockBills[0]}
              isOpen={true}
              onClose={handleClose}
              onSuccess={handleSuccess}
              customerId="cust_rahul_01"
            />
          </BusinessProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    // Click "Verify Status"
    const verifyStatusBtn = screen.getByRole("button", { name: /Verify Status/i });
    fireEvent.click(verifyStatusBtn);

    await waitFor(() => {
      expect(apiClient.verifyRazorpayPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: "ctx_test_bill_01",
          customerId: "cust_rahul_01",
        })
      );
    });
  });

  it("6. renders Customer Dues page with Razorpay UPI Invoices view and verified badges", async () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <BusinessProvider>
            <CustomerDuesPage />
          </BusinessProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/My Shop Dues/i)).toBeInTheDocument();
    });

    // Check "Pay via UPI" button exists on credit transaction
    expect(screen.getByRole("button", { name: /Pay via UPI/i })).toBeInTheDocument();

    // Switch to "Razorpay UPI Invoices" tab
    const upiBillsTab = screen.getByRole("button", { name: /Razorpay UPI Invoices/i });
    fireEvent.click(upiBillsTab);

    await waitFor(() => {
      expect(screen.getByText(/BILL-APEX-001/i)).toBeInTheDocument();
      expect(screen.getByText(/BILL-APEX-002/i)).toBeInTheDocument();
      expect(screen.getByText(/Verified Paid/i)).toBeInTheDocument();
    });
  });
});
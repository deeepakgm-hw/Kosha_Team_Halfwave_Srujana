import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { RepayModal } from "../features/customer/RepayModal";
import { CustomerDashboardPage } from "../features/customer/CustomerDashboardPage";
import { Providers } from "../app/providers";
import { CreditTransaction, CustomerDashboardSummary } from "../types/customer";
import { apiClient } from "../lib/api";

const mockTransaction: CreditTransaction = {
  id: "1",
  reference: "TXN-LAK-001",
  customer_id: "cust_rahul_01",
  shop_id: "1",
  shop_name: "Lakshmi Kirana Stores",
  shop_code: "KOSHA-LAKSHMI",
  description: "Monthly staples (Rice, Oil, Spices)",
  purchase_amount: 3200.0,
  initial_paid_amount: 1000.0,
  outstanding_amount: 2200.0,
  transaction_date: "2026-10-20",
  agreed_repayment_date: "2026-11-05",
  status: "upcoming",
  created_at: "2026-10-20T10:00:00Z",
  repayments: [
    {
      id: "1",
      transaction_id: "1",
      amount: 1000.0,
      repayment_date: "2026-10-20",
      payment_method: "cash",
      payment_status: "settled",
      provider_reference: "REC-INIT",
      notes: "Immediate down payment at counter",
      created_at: "2026-10-20T10:00:00Z",
    },
  ],
};

const mockDashboardData: CustomerDashboardSummary = {
  customer: {
    id: "cust_rahul_01",
    display_name: "Rahul Sharma",
    phone: "+91 98765 43210",
    email: "rahul.sharma@example.in",
    created_at: "2026-01-01T00:00:00Z",
  },
  total_outstanding: 6700.0,
  due_within_7_days: 2200.0,
  overdue_amount: 1500.0,
  shops_count: 3,
  status_message: "You have 1 overdue bill of ₹1,500. Clear it to maintain good shop trust.",
  upcoming_repayments: [mockTransaction],
  recent_activity: [
    {
      id: "1",
      customer_id: "cust_rahul_01",
      event_type: "purchase_recorded",
      title: "Credit purchase at Lakshmi Kirana Stores",
      description: "Monthly staples (Rice, Oil, Spices) for ₹3,200",
      amount: 2200.0,
      created_at: "2026-10-20T10:00:00Z",
    },
  ],
  reminders: [
    {
      transaction_id: "1",
      shop_name: "Lakshmi Kirana Stores",
      amount: 2200.0,
      due_date: "2026-11-05",
      urgency: "upcoming",
      message: "Payment due in 12 days",
    },
  ],
};

describe("Customer Entry and Dashboard Experiences", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("kosha_active_customer_id", "cust_rahul_01");
  });

  describe("LoginPage Entry Redesign", () => {
    it("renders dual persona options: Business Owner and Customer Member", () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Providers>
            <LoginPage />
          </Providers>
        </MemoryRouter>
      );

      // Verify Brand Tagline and Context
      expect(screen.getByText(/Know your treasury/i)).toBeInTheDocument();
      expect(screen.getByText(/before it runs dry/i)).toBeInTheDocument();

      // Verify Role selection tabs
      expect(screen.getByRole("button", { name: "Customer" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Business Owner" })).toBeInTheDocument();

      // Verify Sign In CTA and Google Login
      expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    });

    it("allows switching between Customer and Business Owner roles", () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Providers>
            <LoginPage />
          </Providers>
        </MemoryRouter>
      );

      const businessTab = screen.getByRole("button", { name: "Business Owner" });
      fireEvent.click(businessTab);

      // In business mode, sign in button still present, role updated
      expect(businessTab).toHaveClass("bg-white");
    });
  });

  describe("CustomerDashboardPage", () => {
    it("renders KPI cards, quick actions, and upcoming dues from API response", async () => {
      vi.spyOn(apiClient, "getCustomerDashboard").mockResolvedValue(mockDashboardData);
      vi.spyOn(apiClient, "listCustomerBills").mockResolvedValue([]);
      vi.spyOn(apiClient, "listCustomerAutopayMandates").mockResolvedValue([]);
      vi.spyOn(apiClient, "listShopkeeperCustomers").mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={["/customer/dashboard"]}>
          <Providers>
            <CustomerDashboardPage />
          </Providers>
        </MemoryRouter>
      );

      // Verify greeting and headline
      await waitFor(() => {
        expect(screen.getByText(/Good (morning|afternoon|evening)/i)).toBeInTheDocument();
      });

      // Verify Level 1 UPI Quick Action buttons
      expect(screen.getByText(/Scan & Pay/i)).toBeInTheDocument();
      expect(screen.getByText(/My QR Code/i)).toBeInTheDocument();
      expect(screen.getByText(/Pay Bills/i)).toBeInTheDocument();
      expect(screen.getByText(/History/i)).toBeInTheDocument();

      // Verify Outstanding Dues section
      expect(screen.getByText("Current Outstanding Dues")).toBeInTheDocument();
      expect(screen.getAllByText("₹6,700")[0]).toBeInTheDocument();
      expect(screen.getByText(/₹1,500 Overdue/i)).toBeInTheDocument();

      // Verify upcoming repayment card
      expect(screen.getByText("Lakshmi Kirana Stores")).toBeInTheDocument();
      expect(screen.getByText(/Monthly staples \(Rice, Oil, Spices\)/i)).toBeInTheDocument();
    });
  });

  describe("RepayModal Component", () => {
    it("validates repayment amount and submits successfully", async () => {
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      const updatedMock: CreditTransaction = {
        ...mockTransaction,
        outstanding_amount: 0,
        status: "paid",
      };

      vi.spyOn(apiClient, "recordCustomerRepayment").mockResolvedValue(updatedMock);

      render(
        <RepayModal
          isOpen={true}
          onClose={handleClose}
          transaction={mockTransaction}
          onSuccess={handleSuccess}
        />
      );

      // Verify modal header
      expect(screen.getByText("Record Repayment")).toBeInTheDocument();
      expect(screen.getByText("Lakshmi Kirana Stores")).toBeInTheDocument();

      // Default amount should be the full outstanding (2200)
      const submitButton = screen.getByRole("button", { name: /Confirm Demo Repayment/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(apiClient.recordCustomerRepayment).toHaveBeenCalledWith("1", {
          amount: 2200,
          payment_method: "demo_upi",
          notes: undefined,
        });
        expect(handleSuccess).toHaveBeenCalledWith(updatedMock);
      });
    });

    it("prevents overpayment when amount exceeds outstanding balance", async () => {
      render(
        <RepayModal
          isOpen={true}
          onClose={vi.fn()}
          transaction={mockTransaction}
          onSuccess={vi.fn()}
        />
      );

      const amountInput = screen.getByRole("spinbutton");
      fireEvent.change(amountInput, { target: { value: "3000" } });

      const submitButton = screen.getByRole("button", { name: /Confirm Demo Repayment/i });
      fireEvent.submit(submitButton.closest("form")!);

      expect(
        screen.getByText(/Repayment amount cannot exceed the outstanding balance/i)
      ).toBeInTheDocument();
    });
  });
});

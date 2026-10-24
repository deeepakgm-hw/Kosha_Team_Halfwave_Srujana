import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { RepayModal } from "../features/customer/RepayModal";
import { CustomerDashboardPage } from "../features/customer/CustomerDashboardPage";
import { BusinessProvider } from "../context/BusinessContext";
import { LanguageProvider } from "../context/LanguageContext";
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
  });

  describe("LoginPage Entry Redesign", () => {
    it("renders dual persona options: Business Owner and Customer Member", () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <BusinessProvider>
            <LanguageProvider>
              <LoginPage />
            </LanguageProvider>
          </BusinessProvider>
        </MemoryRouter>
      );

      // Verify Brand Tagline and Context
      expect(screen.getByText(/Know your treasury/i)).toBeInTheDocument();
      expect(screen.getByText(/before it runs dry/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /One place to understand your business cash flow, manage shop credit, and stay ahead of repayments/i
        )
      ).toBeInTheDocument();

      // Verify Business Owner Card
      expect(screen.getByText("I'm a business owner")).toBeInTheDocument();
      expect(
        screen.getByText("Forecast cash flow, understand receivables, and plan your next financial move.")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open Business Dashboard/i })).toBeInTheDocument();

      // Verify Customer Card
      expect(screen.getByText("I'm a customer")).toBeInTheDocument();
      expect(
        screen.getByText("Track shop purchases, manage outstanding dues, and never miss a repayment date.")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open Customer Dashboard/i })).toBeInTheDocument();
    });

    it("navigates to /customer/dashboard when customer card is chosen", () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <BusinessProvider>
            <LanguageProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/customer/dashboard" element={<div>Customer Dashboard Target Screen</div>} />
              </Routes>
            </LanguageProvider>
          </BusinessProvider>
        </MemoryRouter>
      );

      const customerButton = screen.getByRole("button", { name: /Open Customer Dashboard/i });
      fireEvent.click(customerButton);

      expect(screen.getByText("Customer Dashboard Target Screen")).toBeInTheDocument();
    });

    it("navigates to /load when business owner card is chosen", () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <BusinessProvider>
            <LanguageProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/load" element={<div>Business Load Data Target Screen</div>} />
              </Routes>
            </LanguageProvider>
          </BusinessProvider>
        </MemoryRouter>
      );

      const businessButton = screen.getByRole("button", { name: /Open Business Dashboard/i });
      fireEvent.click(businessButton);

      expect(screen.getByText("Business Load Data Target Screen")).toBeInTheDocument();
    });
  });

  describe("CustomerDashboardPage", () => {
    it("renders KPI cards, quick actions, and upcoming dues from API response", async () => {
      vi.spyOn(apiClient, "getCustomerDashboard").mockResolvedValue(mockDashboardData);

      render(
        <MemoryRouter initialEntries={["/customer/dashboard"]}>
          <CustomerDashboardPage />
        </MemoryRouter>
      );

      // Verify greeting and headline
      await waitFor(() => {
        expect(screen.getByText(/Good (morning|afternoon|evening)/i)).toBeInTheDocument();
      });

      // Verify 4 KPI cards
      expect(screen.getByText("Total Outstanding")).toBeInTheDocument();
      expect(screen.getByText("₹6,700")).toBeInTheDocument();

      expect(screen.getByText("Due in 7 Days")).toBeInTheDocument();
      expect(screen.getAllByText("₹2,200").length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText("Overdue Amount")).toBeInTheDocument();
      expect(screen.getByText("₹1,500")).toBeInTheDocument();

      expect(screen.getByText("Active Shops")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();

      // Verify Quick Action buttons
      expect(screen.getByText(/Scan Shop QR/i)).toBeInTheDocument();
      expect(screen.getByText(/Pay a Due/i)).toBeInTheDocument();
      expect(screen.getByText(/View My Dues/i)).toBeInTheDocument();
      expect(screen.getByText(/Enter Shop Code/i)).toBeInTheDocument();

      // Verify upcoming repayment card
      expect(screen.getByText("Lakshmi Kirana Stores")).toBeInTheDocument();
      expect(screen.getByText("Monthly staples (Rice, Oil, Spices)")).toBeInTheDocument();
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

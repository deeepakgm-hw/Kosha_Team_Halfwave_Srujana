import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ShopCreditPage } from "../features/shopkeeper/ShopCreditPage";
import { CustomerPayPage } from "../features/customer/CustomerPayPage";
import { BusinessProvider } from "../context/BusinessContext";
import { LanguageProvider } from "../context/LanguageContext";
import { ShopkeeperSummary, ShopkeeperTransaction, Shop } from "../types/customer";
import { apiClient } from "../lib/api";

const mockShops: Shop[] = [
  {
    id: "shop_apex_01",
    shop_name: "Apex Precision Works",
    shop_code: "KOSHA-APEX",
    category: "Industrial Spares & Hardware",
    owner_name: "Vikram Mehta",
    is_verified: true,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "shop_lakshmi_02",
    shop_name: "Sri Lakshmi Provisions",
    shop_code: "KOSHA-LAKSHMI",
    category: "Grocery & Provisions",
    owner_name: "Lakshmi Narayanan",
    is_verified: true,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
  },
];

const mockSummary: ShopkeeperSummary = {
  shop: mockShops[0],
  total_customer_receivables: 3000.0,
  collected_today: 450.0,
  due_in_7_days: 1000.0,
  overdue_receivables: 2000.0,
  customers_with_balance_count: 2,
  total_transactions_count: 3,
};

const mockTransactions: ShopkeeperTransaction[] = [
  {
    id: "ctx_01",
    reference: "TXN-APEX-001",
    customer_id: "cust_rahul_01",
    customer_name: "Rahul Sharma",
    customer_phone: "+91 98765 43210",
    shop_id: "shop_apex_01",
    shop_name: "Apex Precision Works",
    shop_code: "KOSHA-APEX",
    description: "Precision Bolts & Tools",
    purchase_amount: 1500.0,
    initial_paid_amount: 500.0,
    outstanding_amount: 1000.0,
    transaction_date: "2026-10-20",
    agreed_repayment_date: "2026-10-24",
    status: "due_today",
    created_at: "2026-10-20T10:00:00Z",
    repayments: [
      {
        id: "rep_01",
        transaction_id: "ctx_01",
        amount: 500.0,
        repayment_date: "2026-10-20",
        payment_method: "initial_downpayment",
        payment_status: "completed",
        created_at: "2026-10-20T10:00:00Z",
      },
    ],
  },
];

describe("Shopkeeper Shop Credit & QR Experience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders summary cards and shop QR code card", async () => {
    vi.spyOn(apiClient, "listShops").mockResolvedValue(mockShops);
    vi.spyOn(apiClient, "getShopkeeperSummary").mockResolvedValue(mockSummary);
    vi.spyOn(apiClient, "getShopkeeperTransactions").mockResolvedValue(mockTransactions);

    render(
      <MemoryRouter initialEntries={["/shop-credit"]}>
        <BusinessProvider>
          <LanguageProvider>
            <ShopCreditPage />
          </LanguageProvider>
        </BusinessProvider>
      </MemoryRouter>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Shop Credit & Receivables")).toBeInTheDocument();
      expect(screen.getByText("TXN-APEX-001")).toBeInTheDocument();
    });

    // Check KPI cards
    expect(screen.getByText("Total Receivables")).toBeInTheDocument();
    expect(screen.getByText("₹3,000")).toBeInTheDocument();

    expect(screen.getByText("Collected Today")).toBeInTheDocument();
    expect(screen.getByText("₹450")).toBeInTheDocument();

    expect(screen.getByText("Due in 7 Days")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,000").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Overdue Receivables")).toBeInTheDocument();
    expect(screen.getByText("₹2,000")).toBeInTheDocument();

    // Check QR Panel
    expect(screen.getByText("Official Shop Identification QR")).toBeInTheDocument();
    expect(screen.getByText("Download QR (PNG)")).toBeInTheDocument();
    expect(screen.getByText("Copy Code")).toBeInTheDocument();

    // Check Transaction in Ledger Table
    expect(screen.getByText("Rahul Sharma")).toBeInTheDocument();
    expect(screen.getByText("Precision Bolts & Tools")).toBeInTheDocument();
  });

  it("opens record payment modal and submits counter collection successfully", async () => {
    vi.spyOn(apiClient, "listShops").mockResolvedValue(mockShops);
    vi.spyOn(apiClient, "getShopkeeperSummary").mockResolvedValue(mockSummary);
    vi.spyOn(apiClient, "getShopkeeperTransactions").mockResolvedValue(mockTransactions);

    const updatedTxn: ShopkeeperTransaction = {
      ...mockTransactions[0],
      outstanding_amount: 500.0,
    };
    vi.spyOn(apiClient, "recordShopkeeperRepayment").mockResolvedValue(updatedTxn);

    render(
      <MemoryRouter initialEntries={["/shop-credit"]}>
        <BusinessProvider>
          <LanguageProvider>
            <ShopCreditPage />
          </LanguageProvider>
        </BusinessProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("TXN-APEX-001")).toBeInTheDocument();
    });

    // Click Record Pay button
    const recordPayBtn = screen.getByRole("button", { name: /Record Pay/i });
    fireEvent.click(recordPayBtn);

    // Check modal opened
    expect(screen.getByText("Record Received Payment")).toBeInTheDocument();

    // Submit payment
    const confirmBtn = screen.getByRole("button", { name: /Confirm Received Payment/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.recordShopkeeperRepayment).toHaveBeenCalledWith(
        "ctx_01",
        expect.objectContaining({
          amount: 1000,
          payment_method: "shopkeeper_cash",
        }),
        "KOSHA-APEX"
      );
    });
  });

  it("customer pay wizard resolves shop code and calculates remaining credit balance", async () => {
    vi.spyOn(apiClient, "listShops").mockResolvedValue(mockShops);
    vi.spyOn(apiClient, "getShopByCode").mockResolvedValue(mockShops[0]);

    render(
      <MemoryRouter initialEntries={["/customer/pay"]}>
        <CustomerPayPage />
      </MemoryRouter>
    );

    // Wait for step 1
    await waitFor(() => {
      expect(screen.getByText("Step 1: Identify Participating Shop")).toBeInTheDocument();
    });

    // Click on Apex shop quick shortcut
    const apexBtn = screen.getByRole("button", { name: /Apex Precision Works/i });
    fireEvent.click(apexBtn);

    // Should advance to step 2
    await waitFor(() => {
      expect(screen.getByText("Apex Precision Works")).toBeInTheDocument();
      expect(screen.getByText("KOSHA-APEX")).toBeInTheDocument();
      expect(screen.getByText("Total Purchase Value (₹) *")).toBeInTheDocument();
    });

    // Verify calculated remaining balance
    expect(screen.getByText("Remaining Credit Balance")).toBeInTheDocument();
  });
});

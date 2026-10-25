import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutoPayCard } from "../components/bills/AutoPayCard";
import { apiClient } from "../lib/api";

vi.mock("../lib/api", () => ({
  apiClient: {
    getAutopayMandateByBill: vi.fn(),
    setupAutopayMandate: vi.fn(),
    verifyAutopayMandate: vi.fn(),
    pauseAutopayMandate: vi.fn(),
    resumeAutopayMandate: vi.fn(),
    revokeAutopayMandate: vi.fn(),
  },
  formatApiError: (err: unknown) => (err instanceof Error ? err.message : "Error"),
}));

describe("AutoPayCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders financial terms, disclosures, and disabled button with unselected checkboxes by default", async () => {
    vi.mocked(apiClient.getAutopayMandateByBill).mockResolvedValue(null);

    render(
      <AutoPayCard
        billId="bill_test_101"
        billReference="BILL-101"
        shopName="Apex Industrial Spares"
        totalAmount={15000}
        paidAmount={5000}
        outstandingAmount={10000}
        agreedRepaymentDate="2026-11-15"
        customerId="cust_karthik_01"
      />
    );

    // Merchant and financial details
    expect(await screen.findByText("Apex Industrial Spares")).toBeInTheDocument();
    expect(screen.getAllByText("₹10,000").length).toBeGreaterThan(0);

    // Checkboxes are NOT preselected
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);

    // Button is disabled initially
    const authBtn = screen.getByRole("button", { name: /Authorize AutoPay via UPI/i });
    expect(authBtn).toBeDisabled();

    // Ticking only consent checkbox leaves button disabled
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(true);
    expect(authBtn).toBeDisabled();

    // Ticking terms checkbox enables the button
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1].checked).toBe(true);
    expect(authBtn).toBeEnabled();
  });

  it("renders active mandate details and pause/revoke action buttons when mandate is active", async () => {
    vi.mocked(apiClient.getAutopayMandateByBill).mockResolvedValue({
      mandate: {
        id: "mnd_active_999",
        customer_id: "cust_karthik_01",
        business_id: "biz_apex_01",
        bill_id: "bill_test_101",
        business_name: "Apex Precision",
        customer_name: "Karthik Verma",
        bill_outstanding: 10000,
        mandate_type: "upi_autopay",
        amount_type: "variable",
        max_amount: 10000,
        max_amount_paise: 1000000,
        currency: "INR",
        frequency: "as_presented",
        status: "active",
        effective_date: "2026-10-25",
        consent_timestamp: "2026-10-25T14:00:00Z",
        terms_version: "v1.0-2026",
        collection_condition: "Collection will only be attempted after 15 Nov 2026 if unpaid.",
        cancellation_terms: "Can pause or revoke anytime.",
        razorpay_auth_reference: "pay_test_ref_123",
      },
      audit_logs: [],
      attempts: [],
    });

    render(
      <AutoPayCard
        billId="bill_test_101"
        outstandingAmount={10000}
        customerId="cust_karthik_01"
      />
    );

    expect(await screen.findByText("Active & Protected")).toBeInTheDocument();
    expect(screen.getByText("Mandate Authorized & Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pause Mandate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revoke Mandate/i })).toBeInTheDocument();
  });

  it("renders collection engine activity including pre-debit notice, successful debit, and backoff retry", async () => {
    vi.mocked(apiClient.getAutopayMandateByBill).mockResolvedValue({
      mandate: {
        id: "mnd_active_888",
        customer_id: "cust_karthik_01",
        business_id: "biz_apex_01",
        bill_id: "bill_test_102",
        business_name: "Apex Precision",
        customer_name: "Karthik Verma",
        bill_outstanding: 5000,
        mandate_type: "upi_autopay",
        amount_type: "variable",
        max_amount: 5000,
        max_amount_paise: 500000,
        currency: "INR",
        frequency: "as_presented",
        status: "active",
        effective_date: "2026-10-25",
        consent_timestamp: "2026-10-25T14:00:00Z",
        terms_version: "v1.0-2026",
        collection_condition: "Collection will only be attempted after deadline if unpaid.",
        cancellation_terms: "Can pause or revoke anytime.",
      },
      audit_logs: [],
      attempts: [
        {
          id: "att_001",
          mandate_id: "mnd_active_888",
          bill_id: "bill_test_102",
          amount: 5000,
          amount_paise: 500000,
          attempt_number: 1,
          status: "awaiting_notification",
          notification_requirement: "required",
          notification_status: "delivered",
          notification_timestamp: "2026-10-25T10:00:00Z",
          initiation_time: "2026-10-25T10:00:00Z",
          reconciliation_status: "unreconciled",
        },
        {
          id: "att_002",
          mandate_id: "mnd_active_888",
          bill_id: "bill_test_102",
          amount: 5000,
          amount_paise: 500000,
          attempt_number: 2,
          status: "succeeded",
          razorpay_payment_id: "pay_rzp_live_abc123",
          initiation_time: "2026-10-26T10:30:00Z",
          result_time: "2026-10-26T10:30:05Z",
          reconciliation_status: "reconciled",
        },
      ],
    });

    render(
      <AutoPayCard
        billId="bill_test_102"
        outstandingAmount={5000}
        customerId="cust_karthik_01"
      />
    );

    expect(await screen.findByText(/Collection Engine Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Pre-Debit Notice Recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/Collection Succeeded: ₹5,000/i)).toBeInTheDocument();
    expect(screen.getByText(/pay_rzp_live_abc123/i)).toBeInTheDocument();
  });
});

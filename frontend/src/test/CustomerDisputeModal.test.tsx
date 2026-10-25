import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CustomerDisputeModal } from "../components/bills/CustomerDisputeModal";
import { apiClient } from "../lib/api";

describe("CustomerDisputeModal Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    billId: "bill_test_01",
    billReference: "TXN-TEST-100",
    shopName: "Apex Kirana",
    outstandingAmount: 1500.0,
    customerId: "cust_test_01",
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  it("renders modal header, shop name, bill reference, and dispute type options", () => {
    render(<CustomerDisputeModal {...defaultProps} />);

    expect(screen.getByText(/Flag Bill Discrepancy/i)).toBeInTheDocument();
    expect(screen.getByText(/TXN-TEST-100/i)).toBeInTheDocument();
    expect(screen.getByText(/Apex Kirana/i)).toBeInTheDocument();
    expect(screen.getByText(/Incorrect Bill Amount \/ Missing Discount/i)).toBeInTheDocument();
    expect(screen.getByText(/AutoPay Freezes/i)).toBeInTheDocument();
  });

  it("validates description input length before submission", async () => {
    render(<CustomerDisputeModal {...defaultProps} />);

    const submitBtn = screen.getByRole("button", { name: /Submit Dispute/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/Please provide a detailed explanation \(minimum 5 characters\)\./i)
    ).toBeInTheDocument();
  });

  it("submits dispute payload and freezes AutoPay collections with success feedback", async () => {
    const raiseSpy = vi.spyOn(apiClient, "raiseDispute").mockResolvedValue({
      dispute_id: "disp_01",
      bill_id: "bill_test_01",
      status: "open",
      message: "Dispute registered. Automatic collections have been paused.",
    });

    render(<CustomerDisputeModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/Describe what occurred/i);
    fireEvent.change(textarea, {
      target: { value: "I returned the rice bag on Oct 22 and bill amount was not deducted." },
    });

    const submitBtn = screen.getByRole("button", { name: /Submit Dispute/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(raiseSpy).toHaveBeenCalledWith(
        {
          bill_id: "bill_test_01",
          dispute_type: "incorrect_amount",
          description: "I returned the rice bag on Oct 22 and bill amount was not deducted.",
        },
        "cust_test_01"
      );
    });

    expect(
      screen.getByText(/Dispute registered\. Automatic collections have been paused\./i)
    ).toBeInTheDocument();
  });
});

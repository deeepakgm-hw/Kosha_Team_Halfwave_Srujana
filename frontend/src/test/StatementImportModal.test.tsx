import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StatementImportModal } from "../features/statements/StatementImportModal";
import { ApiError, formatApiError } from "../lib/api";

describe("formatApiError Utility", () => {
  it("formats Pydantic 422 validation errors with field location and message", () => {
    const apiErr = new ApiError(422, "API error [422]: Unprocessable Content", {
      detail: [
        {
          loc: ["body", "account_number_mask"],
          msg: "Field required",
          type: "missing",
        },
      ],
    });

    const formatted = formatApiError(apiErr);
    expect(formatted).toBe("Validation error: account_number_mask: Field required");
  });

  it("formats Kosha AppException envelope error messages", () => {
    const apiErr = new ApiError(409, "API error [409]: Conflict", {
      error: {
        code: "DUPLICATE_FILE_IMPORT",
        message: "This exact CSV file ('oct.csv') has already been imported on 2026-10-24.",
      },
    });

    const formatted = formatApiError(apiErr);
    expect(formatted).toBe("This exact CSV file ('oct.csv') has already been imported on 2026-10-24.");
  });

  it("formats string detail HTTPException messages", () => {
    const apiErr = new ApiError(422, "API error [422]: Unprocessable Content", {
      detail: "Missing date column. Please include a column named 'date'.",
    });

    const formatted = formatApiError(apiErr);
    expect(formatted).toBe("Missing date column. Please include a column named 'date'.");
  });
});

describe("StatementImportModal Component", () => {
  it("renders modal header and fields when isOpen is true", () => {
    render(
      <StatementImportModal
        businessId="apex_precision_mfg"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText("Import Bank Statement (CSV)")).toBeInTheDocument();
    expect(screen.getByText("Select CSV Statement File *")).toBeInTheDocument();
    expect(screen.getByText(/Account Opening Balance/)).toBeInTheDocument();
    expect(screen.getByText(/Opening Balance Date/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import & Reconcile" })).toBeInTheDocument();
  });

  it("allows selecting a file and enables submit button", async () => {
    render(
      <StatementImportModal
        businessId="apex_precision_mfg"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole("button", { name: "Import & Reconcile" });
    expect(submitBtn).toBeDisabled();

    const file = new File(["Date,Description,Amount\n2026-10-01,Inflow,10000.00\n"], "test_statement.csv", {
      type: "text/csv",
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
      expect(screen.getByText(/test_statement\.csv/)).toBeInTheDocument();
    });
  });

  it("accepts numeric opening balance entry without date", () => {
    render(
      <StatementImportModal
        businessId="apex_precision_mfg"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const openingInput = screen.getByPlaceholderText("e.g. 500000") as HTMLInputElement;
    fireEvent.change(openingInput, { target: { value: "234554" } });
    expect(openingInput.value).toBe("234554");
  });
});

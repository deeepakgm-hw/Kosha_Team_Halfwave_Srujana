import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForecastPage } from "../features/forecast/ForecastPage";
import { apiClient } from "../lib/api";
import { ForecastResponse } from "../types/cashflow";
import { BusinessProvider } from "../context/BusinessContext";

// Mock ResponsiveContainer for Recharts so it renders in JSDOM
vi.mock("recharts", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-container" style={{ width: 800, height: 350 }}>
        {children}
      </div>
    ),
  };
});

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<BusinessProvider>{ui}</BusinessProvider>);
};

const mockSuccessResponse: ForecastResponse = {
  business_id: "apex_precision_mfg",
  forecast_generated_at: "2026-10-24T12:00:00Z",
  start_date: "2026-11-01",
  horizon_days: 90,
  starting_cash: 450000.0,
  closing_cash: -25000.0,
  total_inflows: 475000.0,
  total_outflows: 950000.0,
  net_change: -475000.0,
  minimum_projected_balance: -35000.0,
  minimum_reserve: 50000.0,
  first_projected_shortfall_date: "2026-11-20",
  first_reserve_breach_date: "2026-11-15",
  negative_cash_days_count: 14,
  days_below_reserve_count: 22,
  runway_days: 19,
  is_probabilistic: false,
  is_synthetic: true,
  data_quality_warnings: [],
  assumptions_used: ["Deterministic scheduled due dates applied"],
  daily_projections: [
    {
      date: "2026-11-01",
      starting_cash: 450000.0,
      expected_inflow: 0.0,
      committed_outflow: 0.0,
      net_cash_flow: 0.0,
      ending_cash: 450000.0,
      is_shortfall: false,
      shortfall_amount: 0.0,
      is_reserve_breach: false,
      is_synthetic: true,
    },
    {
      date: "2026-11-20",
      starting_cash: 10000.0,
      expected_inflow: 0.0,
      committed_outflow: 45000.0,
      net_cash_flow: -45000.0,
      ending_cash: -35000.0,
      is_shortfall: true,
      shortfall_amount: 35000.0,
      is_reserve_breach: true,
      is_synthetic: true,
    },
  ],
};

describe("ForecastPage component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially while fetching forecast", () => {
    vi.spyOn(apiClient, "getForecast").mockImplementation(() => new Promise(() => {}));

    renderWithProvider(<ForecastPage />);
    expect(screen.getByText(/calculating 90-day rolling cash-flow trajectory/i)).toBeInTheDocument();
  });

  it("renders forecast metrics, shortfall alert, and Recharts container on success", async () => {
    vi.spyOn(apiClient, "getForecast").mockResolvedValue(mockSuccessResponse);

    renderWithProvider(<ForecastPage />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.queryByText(/calculating/i)).not.toBeInTheDocument();
    });

    // Check heading & badges
    expect(screen.getByText("90-Day Rolling Cash Forecast")).toBeInTheDocument();
    expect(screen.getByText("Deterministic Simulation")).toBeInTheDocument();
    expect(screen.getByText("Synthetic Profile")).toBeInTheDocument();

    // Check Shortfall Alert banner
    expect(screen.getByText("Projected Cash Shortfall Alert")).toBeInTheDocument();
    expect(screen.getByText(/cash balance is projected to dip below zero/i)).toBeInTheDocument();

    // Check KPI cards
    expect(screen.getAllByText("Opening Cash")[0]).toBeInTheDocument();
    expect(screen.getByText("Minimum Cash")).toBeInTheDocument();
    expect(screen.getByText("First Shortfall")).toBeInTheDocument();
    expect(screen.getByText("14 Days")).toBeInTheDocument();

    // Check chart container
    expect(screen.getByTestId("recharts-container")).toBeInTheDocument();

    // Check breakdown table rows
    expect(screen.getByText("Daily Ledger Projection Breakdown")).toBeInTheDocument();
  });

  it("renders error state when API fails and retries on button click", async () => {
    const getForecastSpy = vi
      .spyOn(apiClient, "getForecast")
      .mockRejectedValueOnce(new Error("Network timeout: 504 Gateway Timeout"))
      .mockResolvedValueOnce(mockSuccessResponse);

    renderWithProvider(<ForecastPage />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText("Forecasting Error")).toBeInTheDocument();
      expect(screen.getByText(/Network timeout: 504 Gateway Timeout/i)).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    // Verify resolved response
    await waitFor(() => {
      expect(screen.getByText("90-Day Rolling Cash Forecast")).toBeInTheDocument();
    });
    expect(getForecastSpy).toHaveBeenCalledTimes(2);
  });

  it("renders data quality warning banner when warnings are present", async () => {
    const responseWithWarnings: ForecastResponse = {
      ...mockSuccessResponse,
      first_projected_shortfall_date: null,
      minimum_projected_balance: 75000.0,
      closing_cash: 75000.0,
      negative_cash_days_count: 0,
      first_reserve_breach_date: null,
      days_below_reserve_count: 0,
      data_quality_warnings: ["NO_BANK_ACCOUNT: No verified bank accounts recorded."],
      assumptions_used: ["Zero cash opening assumed"],
    };

    vi.spyOn(apiClient, "getForecast").mockResolvedValue(responseWithWarnings);

    renderWithProvider(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText("Data Reliability & Quality Advisories")).toBeInTheDocument();
      expect(
        screen.getByText("NO_BANK_ACCOUNT: No verified bank accounts recorded.")
      ).toBeInTheDocument();
    });
  });

  it("renders reserve breach alert when cash dips below minimum reserve without zero shortfall", async () => {
    const responseWithReserveBreach: ForecastResponse = {
      ...mockSuccessResponse,
      first_projected_shortfall_date: null,
      minimum_projected_balance: 20000.0,
      minimum_reserve: 50000.0,
      first_reserve_breach_date: "2026-11-15",
      days_below_reserve_count: 10,
      negative_cash_days_count: 0,
      closing_cash: 25000.0,
    };

    vi.spyOn(apiClient, "getForecast").mockResolvedValue(responseWithReserveBreach);

    renderWithProvider(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText("Minimum Reserve Breach Warning")).toBeInTheDocument();
      expect(screen.getByText(/breaches your/i)).toBeInTheDocument();
    });
  });
});

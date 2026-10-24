import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { KnowForecastPage } from "../features/forecast/KnowForecastPage";
import { apiClient } from "../lib/api";
import { ForecastResponse } from "../types/cashflow";
import { BusinessProvider } from "../context/BusinessContext";

// Mock ResponsiveContainer for Recharts
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
  return render(
    <BrowserRouter>
      <BusinessProvider>{ui}</BusinessProvider>
    </BrowserRouter>
  );
};

const mockForecastResponse: ForecastResponse = {
  business_id: "apex_precision_mfg",
  forecast_generated_at: "2026-10-24T12:00:00Z",
  start_date: "2026-11-01",
  horizon_days: 90,
  starting_cash: 450000.0,
  closing_cash: -25000.0,
  total_inflows: 360000.0,
  total_outflows: 797000.0,
  net_change: -437000.0,
  minimum_projected_balance: -35000.0,
  minimum_reserve: 100000.0,
  first_projected_shortfall_date: "2026-12-09",
  first_reserve_breach_date: "2026-11-28",
  negative_cash_days_count: 14,
  days_below_reserve_count: 22,
  runway_days: 52,
  is_probabilistic: false,
  is_synthetic: true,
  data_quality_warnings: [],
  assumptions_used: [],
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
      date: "2026-12-09",
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

describe("KnowForecastPage Component (Stage 2: Forecast)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders light glassmorphism headline, chart, and 3 metric cards", async () => {
    vi.spyOn(apiClient, "getForecast").mockResolvedValue(mockForecastResponse);

    renderWithProvider(<KnowForecastPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Your 90-day cash-flow forecast")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Cash shortfall risk/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getAllByText(/safety buffer/i)[0]
    ).toBeInTheDocument();

    // Check 3 metric cards
    expect(screen.getByText("Cash balance today")).toBeInTheDocument();
    expect(screen.getByText("Expected but not yet received")).toBeInTheDocument();
    expect(screen.getByText("Runway")).toBeInTheDocument();
    expect(screen.getByText(/52/i)).toBeInTheDocument();

    // Check bottom navigation buttons
    expect(screen.getByText("Back: Load data")).toBeInTheDocument();
    expect(screen.getByText("Next: Test scenarios")).toBeInTheDocument();
  });
});

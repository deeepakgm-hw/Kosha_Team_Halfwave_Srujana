import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CustomerTrustScorePage } from "../features/customer/CustomerTrustScorePage";
import { apiClient } from "../lib/api";
import { TrustScoreDetail, TrustScoreHistoryItem } from "../types/customer";

// Mock ResponsiveContainer for Recharts in JSDOM
vi.mock("recharts", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="trustscore-recharts-container" style={{ width: 600, height: 200 }}>
        {children}
      </div>
    ),
  };
});

const mockTrustScore: TrustScoreDetail = {
  customer_id: "cust_rahul_01",
  score: 88,
  score_category: "excellent",
  has_sufficient_history: true,
  model_version: "v1.0",
  calculation_timestamp: "2026-10-26T00:00:00Z",
  breakdown: {
    on_time_performance: {
      score: 38.0,
      max_score: 40.0,
      percentage: 95.0,
      weight_description: "40% Weight",
    },
    overdue_frequency_duration: {
      score: 23.5,
      max_score: 25.0,
      percentage: 94.0,
      weight_description: "25% Weight",
    },
    current_overdue_ratio: {
      score: 18.0,
      max_score: 20.0,
      percentage: 90.0,
      weight_description: "20% Weight",
    },
    recency_consistency: {
      score: 8.5,
      max_score: 15.0,
      percentage: 56.7,
      weight_description: "15% Weight",
    },
  },
  metrics: {
    total_obligations: 4,
    completed_obligations: 4,
    on_time_obligations: 4,
    late_obligations: 0,
    active_overdue_count: 0,
    on_time_ratio_pct: 100.0,
    total_borrowed_inr: 8000.0,
    total_repaid_inr: 8000.0,
    current_outstanding_inr: 0.0,
    current_overdue_inr: 0.0,
  },
  delta: {
    previous_score: 85,
    score_change: 3,
    change_reason: "Prompt settlement of Kirana bill",
  },
  signals: {
    positive_factors: [
      "100% on-time repayment track record across recent shop bills.",
      "Zero currently overdue credit balances across all stores.",
    ],
    risk_factors: [],
  },
  methodology_notes:
    "KOSHA TrustScore is an internal repayment reliability index based strictly on store transactions and is not an external credit bureau rating.",
};

const mockHistory: TrustScoreHistoryItem[] = [
  {
    id: "snap_1",
    score: 85,
    score_category: "good",
    score_change: null,
    change_reason: "Initial snapshot",
    timestamp: "2026-10-15T00:00:00Z",
    on_time_ratio_pct: 100.0,
    outstanding_inr: 2200.0,
  },
  {
    id: "snap_2",
    score: 88,
    score_category: "excellent",
    score_change: 3,
    change_reason: "Prompt repayment",
    timestamp: "2026-10-25T00:00:00Z",
    on_time_ratio_pct: 100.0,
    outstanding_inr: 0.0,
  },
];

describe("CustomerTrustScorePage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders TrustScore gauge, 4-factor breakdown, and positive signals on load", async () => {
    vi.spyOn(apiClient, "getCustomerTrustScore").mockResolvedValue(mockTrustScore);
    vi.spyOn(apiClient, "getTrustScoreHistory").mockResolvedValue(mockHistory);

    render(
      <MemoryRouter initialEntries={["/customer/trustscore"]}>
        <CustomerTrustScorePage />
      </MemoryRouter>
    );

    // Score display
    await waitFor(() => {
      expect(screen.getByText("88")).toBeInTheDocument();
    });

    // Rating category
    expect(screen.getAllByText(/Excellent Reliability/i)[0]).toBeInTheDocument();

    // 4 Deterministic Factor Breakdown Labels
    expect(screen.getByText(/On-Time Repayment Performance/i)).toBeInTheDocument();
    expect(screen.getByText(/Overdue Frequency & Duration/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Verified Overdue Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Consistency & Recency of Repayments/i)).toBeInTheDocument();

    // Signals
    expect(
      screen.getByText(/100% on-time repayment track record across recent shop bills\./i)
    ).toBeInTheDocument();

    // Regulatory disclaimer and dispute action banner
    expect(screen.getByText(/NOT an official credit bureau score/i)).toBeInTheDocument();
    expect(screen.getByText(/Notice an inaccurate bill or missing payment/i)).toBeInTheDocument();
  });

  it("handles insufficient history customer profile accurately without fake scores", async () => {
    const newCustomerScore: TrustScoreDetail = {
      ...mockTrustScore,
      score: null,
      score_category: "insufficient_history",
      has_sufficient_history: false,
      signals: {
        positive_factors: [],
        risk_factors: ["Customer has fewer than 2 completed credit obligations."],
      },
      metrics: {
        ...mockTrustScore.metrics,
        total_obligations: 1,
        completed_obligations: 0,
      },
    };

    vi.spyOn(apiClient, "getCustomerTrustScore").mockResolvedValue(newCustomerScore);
    vi.spyOn(apiClient, "getTrustScoreHistory").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/customer/trustscore"]}>
        <CustomerTrustScorePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Awaiting History")).toBeInTheDocument();
    });

    expect(screen.getByText(/New \/ Insufficient History/i)).toBeInTheDocument();
    expect(screen.getByText(/fewer than 2 completed credit obligations/i)).toBeInTheDocument();
  });

  it("triggers recalculation when recalculate button is clicked", async () => {
    vi.spyOn(apiClient, "getCustomerTrustScore").mockResolvedValue(mockTrustScore);
    vi.spyOn(apiClient, "getTrustScoreHistory").mockResolvedValue(mockHistory);
    const recalcSpy = vi.spyOn(apiClient, "recalculateTrustScore").mockResolvedValue(mockTrustScore);

    render(
      <MemoryRouter initialEntries={["/customer/trustscore"]}>
        <CustomerTrustScorePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("88")).toBeInTheDocument();
    });

    const recalcBtn = screen.getByRole("button", { name: /Recalculate/i });
    fireEvent.click(recalcBtn);

    await waitFor(() => {
      expect(recalcSpy).toHaveBeenCalledWith("cust_rahul_01", "user_manual_refresh");
    });
  });
});

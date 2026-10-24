import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { App } from "../app/App";

describe("KOSHA Application Entry Point", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders KOSHA brand logo, navigation stepper, Sign Out, and Load page", async () => {
    render(<App />);

    // Check brand header
    expect(screen.getByText("KOSHA")).toBeInTheDocument();

    // Check 5 primary workflow stages
    expect(screen.getAllByText("Load data")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Understand cash flow")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Test scenarios")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Compare actions")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Action plan")[0]).toBeInTheDocument();

    // Check supporting tools
    expect(screen.getAllByText("Receivables")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Cash calendar")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Forecast reliability")[0]).toBeInTheDocument();

    // Check Sign Out option
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    // Check main Load page heading & options
    expect(screen.getByText("Load your business data")).toBeInTheDocument();
    expect(screen.getByText("Sample business")).toBeInTheDocument();
    expect(screen.getByText("Upload CSV files")).toBeInTheDocument();
    expect(screen.getByText("Build my forecast")).toBeInTheDocument();
  });

  it("dynamically translates UI when switching between English, Hindi, and Kannada", async () => {
    render(<App />);

    // Switch to Hindi
    const hindiButton = screen.getByRole("button", { name: /hindi language/i });
    fireEvent.click(hindiButton);

    // Verify Hindi translation rendered in navigation and page
    expect(screen.getAllByText("डेटा लोड करें")[0]).toBeInTheDocument();
    expect(screen.getAllByText("कैश फ्लो समझें")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /साइन आउट/i })).toBeInTheDocument();

    // Switch to Kannada
    const kannadaButton = screen.getByRole("button", { name: /kannada language/i });
    fireEvent.click(kannadaButton);

    // Verify Kannada translation rendered in navigation and page
    expect(screen.getAllByText("ಡೇಟಾ ಲೋಡ್ ಮಾಡಿ")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ನಗದು ಹರಿವು ತಿಳಿಯಿರಿ")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ಸೈನ್ ಔಟ್/i })).toBeInTheDocument();

    // Switch back to English
    const englishButton = screen.getByRole("button", { name: /english language/i });
    fireEvent.click(englishButton);

    // Verify English restored
    expect(screen.getAllByText("Load data")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Understand cash flow")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

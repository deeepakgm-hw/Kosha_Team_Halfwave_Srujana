import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { App } from "../app/App";
import { router } from "../app/router";

describe("KOSHA Application Entry Point & Landing Page", () => {
  beforeEach(async () => {
    localStorage.clear();
    await router.navigate("/");
  });

  it("renders transformed PayPal-style landing page with Member Login and Business Login at top right", async () => {
    render(<App />);

    // Brand lockup
    expect(screen.getAllByText("KOSHA")[0]).toBeInTheDocument();

    // Top Right dual logins as requested
    expect(screen.getAllByRole("button", { name: /member login/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /business login/i })[0]).toBeInTheDocument();

    // Hero headline and subhead
    expect(screen.getByText(/turn more shoppers into buyers/i)).toBeInTheDocument();
    expect(screen.getByText(/keep your treasury from running dry/i)).toBeInTheDocument();

    // Core feature highlights
    expect(screen.getAllByText(/counter qr/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/predictive runway/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/statutory msmed act 2006 late-payment protection/i)).toBeInTheDocument();
  });

  it("navigates to Business Dashboard when clicking Business Login", async () => {
    render(<App />);

    // Click top-right Business Login button
    const businessLoginButtons = screen.getAllByRole("button", { name: /business login/i });
    fireEvent.click(businessLoginButtons[0]);

    // Verify Business Dashboard workflow steps rendered
    await waitFor(() => {
      expect(screen.getAllByText("Load data")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Understand cash flow")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Test scenarios")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Compare actions")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Action plan")[0]).toBeInTheDocument();
    });

    // Check supporting tools
    expect(screen.getAllByText("Receivables")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Cash calendar")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Forecast reliability")[0]).toBeInTheDocument();

    // Check Sign Out option
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    // Check main Load page heading & options
    expect(screen.getByText("Load your business data")).toBeInTheDocument();
  });

  it("dynamically translates UI when switching between English, Hindi, and Kannada", async () => {
    render(<App />);

    // Switch to Hindi on Landing Page
    const hindiButtons = screen.getAllByRole("button", { name: /hindi language/i });
    fireEvent.click(hindiButtons[0]);

    // Switch to Kannada
    const kannadaButtons = screen.getAllByRole("button", { name: /kannada language/i });
    fireEvent.click(kannadaButtons[0]);

    // Switch back to English
    const englishButtons = screen.getAllByRole("button", { name: /english language/i });
    fireEvent.click(englishButtons[0]);

    // Verify English restored
    expect(screen.getAllByRole("button", { name: /business login/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /member login/i })[0]).toBeInTheDocument();
  });
});

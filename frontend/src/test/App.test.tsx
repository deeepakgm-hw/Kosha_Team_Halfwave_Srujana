import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "../features/landing/LandingPage";
import { Providers } from "../app/providers";

describe("KOSHA Application Entry Point & Landing Page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders PayPal-style landing page with Member Login and Business Login", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Providers>
          <LandingPage />
        </Providers>
      </MemoryRouter>
    );

    // Brand wordmark exists (KO SHA)
    expect(screen.getAllByText(/KO/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/SHA/)[0]).toBeInTheDocument();

    // Top Right dual logins as requested
    expect(screen.getAllByRole("button", { name: /member login/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /business login/i })[0]).toBeInTheDocument();

    // Hero headline and subhead
    expect(screen.getByText(/turn more shoppers into buyers/i)).toBeInTheDocument();
    expect(screen.getByText(/keep your treasury from running dry/i)).toBeInTheDocument();
  });

  it("navigates to Login page when clicking Business Login", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Providers>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<div data-testid="login-page">Login Page Route</div>} />
          </Routes>
        </Providers>
      </MemoryRouter>
    );

    // Click top-right Business Login button
    const businessLoginButtons = screen.getAllByRole("button", { name: /business login/i });
    fireEvent.click(businessLoginButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });

  it("allows switching language between English, Hindi, and Kannada", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Providers>
          <LandingPage />
        </Providers>
      </MemoryRouter>
    );

    // Switch to Hindi
    const hindiButton = screen.getByRole("button", { name: /hindi language/i });
    fireEvent.click(hindiButton);
    expect(hindiButton).toHaveClass("bg-white");

    // Switch to Kannada
    const kannadaButton = screen.getByRole("button", { name: /kannada language/i });
    fireEvent.click(kannadaButton);
    expect(kannadaButton).toHaveClass("bg-white");

    // Switch back to English
    const englishButton = screen.getByRole("button", { name: /english language/i });
    fireEvent.click(englishButton);
    expect(englishButton).toHaveClass("bg-white");
  });
});

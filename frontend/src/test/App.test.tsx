import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "../app/App";

describe("KOSHA Application Entry Point", () => {
  it("renders KOSHA title in sidebar and Know header", async () => {
    render(<App />);

    // Check brand header
    expect(screen.getByText("KOSHA")).toBeInTheDocument();
    expect(screen.getByText("Predictive Cash Treasury")).toBeInTheDocument();

    // Check main dashboard heading
    expect(screen.getByText("Know — Treasury Overview")).toBeInTheDocument();

    // Check financial category distinction
    expect(screen.getByText("Settled Bank Cash")).toBeInTheDocument();
    expect(screen.getByText("Expected Inflows (30d)")).toBeInTheDocument();
    expect(screen.getByText("Committed Dues (30d)")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "../components/ui/Button";

describe("Button component", () => {
  it("renders with default props and text", () => {
    render(<Button>Simulate</Button>);
    const button = screen.getByRole("button", { name: /simulate/i });
    expect(button).toBeInTheDocument();
  });

  it("shows loading indicator when isLoading is true", () => {
    render(<Button isLoading>Action</Button>);
    expect(screen.getByText(/loading.../i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

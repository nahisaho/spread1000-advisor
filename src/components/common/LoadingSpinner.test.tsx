import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders with default size", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders with label", () => {
    render(<LoadingSpinner label="Please wait..." />);
    expect(screen.getByText("Please wait...")).toBeDefined();
  });

  it("renders small size correctly", () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner?.classList.contains("h-4")).toBe(true);
    expect(spinner?.classList.contains("w-4")).toBe(true);
  });

  it("renders large size correctly", () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner?.classList.contains("h-12")).toBe(true);
    expect(spinner?.classList.contains("w-12")).toBe(true);
  });
});

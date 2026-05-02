import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next-intl
vi.mock("next-intl", () => ({
  useLocale: () => "ja",
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      home: "ホーム",
      settings: "設定",
    };
    return translations[key] ?? key;
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { Header } from "./Header";

describe("Header", () => {
  it("renders app title", () => {
    render(<Header />);
    expect(screen.getByText("SPReAD-1000 Advisor")).toBeDefined();
  });

  it("has language toggle button", () => {
    render(<Header />);
    // locale is "ja", so button shows "EN"
    expect(screen.getByText("EN")).toBeDefined();
  });

  it("renders home link", () => {
    render(<Header />);
    expect(screen.getByText("ホーム")).toBeDefined();
  });
});

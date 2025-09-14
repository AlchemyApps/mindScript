import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import SellerOnboardingPage from "./page";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe("SellerOnboardingPage", () => {
  const mockPush = vi.fn();
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useSearchParams as any).mockReturnValue({ get: mockGet });
  });

  it("should render onboarding welcome screen initially", () => {
    render(<SellerOnboardingPage />);

    expect(screen.getByText(/Become a MindScript Seller/i)).toBeInTheDocument();
    expect(screen.getByText(/Start earning by selling your meditation tracks/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Onboarding/i })).toBeInTheDocument();
  });

  it("should show key benefits of becoming a seller", () => {
    render(<SellerOnboardingPage />);

    expect(screen.getByText(/85% Revenue Share/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Payouts/i)).toBeInTheDocument();
    expect(screen.getByText(/Global Reach/i)).toBeInTheDocument();
    expect(screen.getByText(/Secure Payments/i)).toBeInTheDocument();
  });

  it("should initiate Stripe Connect onboarding when button clicked", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accountId: "acct_123",
        onboardingUrl: "https://connect.stripe.com/setup/e/123",
      }),
    });

    render(<SellerOnboardingPage />);

    const startButton = screen.getByRole("button", { name: /Start Onboarding/i });
    fireEvent.click(startButton);

    expect(screen.getByText(/Setting up your seller account/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/seller/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: expect.stringContaining("/seller/dashboard"),
          refreshUrl: expect.stringContaining("/seller/onboarding"),
        }),
      });
    });
  });

  it("should handle return from Stripe onboarding", async () => {
    mockGet.mockReturnValue("return");

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accountId: "acct_123",
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        requirementsCurrentlyDue: [],
      }),
    });

    render(<SellerOnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Onboarding Complete!/i)).toBeInTheDocument();
      expect(screen.getByText(/Your seller account is now active/i)).toBeInTheDocument();
    });

    expect(mockPush).toHaveBeenCalledWith("/seller/dashboard");
  });

  it("should handle refresh flow when account link expired", async () => {
    mockGet.mockReturnValue("refresh");

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accountId: "acct_123",
        onboardingUrl: "https://connect.stripe.com/setup/e/456",
      }),
    });

    render(<SellerOnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue Onboarding/i })).toBeInTheDocument();
    });
  });

  it("should show requirements if onboarding incomplete", async () => {
    mockGet.mockReturnValue("return");

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accountId: "acct_123",
        detailsSubmitted: true,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsCurrentlyDue: ["individual.verification.document", "bank_account"],
      }),
    });

    render(<SellerOnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Almost there!/i)).toBeInTheDocument();
      expect(screen.getByText(/verification document/i)).toBeInTheDocument();
      expect(screen.getByText(/bank account/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Complete Requirements/i })).toBeInTheDocument();
  });

  it("should handle API errors gracefully", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<SellerOnboardingPage />);

    const startButton = screen.getByRole("button", { name: /Start Onboarding/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to start onboarding/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
    });
  });

  it("should display onboarding progress steps", () => {
    render(<SellerOnboardingPage />);

    expect(screen.getByText(/1. Create Account/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Verify Identity/i)).toBeInTheDocument();
    expect(screen.getByText(/3. Add Bank Account/i)).toBeInTheDocument();
    expect(screen.getByText(/4. Start Selling/i)).toBeInTheDocument();
  });
});
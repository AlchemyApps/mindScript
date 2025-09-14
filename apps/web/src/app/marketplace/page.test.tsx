import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MarketplacePage from "./page";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace",
}));

// Mock API calls
global.fetch = vi.fn();

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/api/marketplace/featured")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            featured: [
              {
                id: "1",
                title: "Featured Track",
                formatted_price: "$4.99",
                category: "meditation",
                seller: { display_name: "John Doe" },
              },
            ],
            popular: [],
            new_releases: [],
          }),
        });
      }
      if (url.includes("/api/marketplace/categories")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            categories: [
              { name: "meditation", label: "Meditation", count: 10, icon: "🧘" },
              { name: "sleep", label: "Sleep", count: 5, icon: "😴" },
            ],
          }),
        });
      }
      if (url.includes("/api/marketplace/listings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            tracks: [
              {
                id: "2",
                title: "Test Track",
                formatted_price: "$2.99",
                category: "sleep",
                seller: { display_name: "Jane Smith" },
              },
            ],
            pagination: { has_next: false },
            filters: {
              categories: [],
              price_range: { min: 99, max: 999 },
              duration_range: { min: 300, max: 900 },
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should render the marketplace page with all sections", async () => {
    render(<MarketplacePage />);
    
    // Check for main heading
    expect(screen.getByRole("heading", { name: /marketplace/i })).toBeInTheDocument();
    
    // Wait for featured section to load
    await waitFor(() => {
      expect(screen.getByText("Featured Track")).toBeInTheDocument();
    });
  });

  it("should display category navigation", async () => {
    render(<MarketplacePage />);
    
    await waitFor(() => {
      expect(screen.getByText("Meditation")).toBeInTheDocument();
      expect(screen.getByText("Sleep")).toBeInTheDocument();
    });
  });

  it("should show featured tracks carousel", async () => {
    render(<MarketplacePage />);
    
    await waitFor(() => {
      expect(screen.getByText("Featured Tracks")).toBeInTheDocument();
      expect(screen.getByText("Featured Track")).toBeInTheDocument();
      expect(screen.getByText("$4.99")).toBeInTheDocument();
    });
  });

  it("should display track listings", async () => {
    render(<MarketplacePage />);
    
    await waitFor(() => {
      expect(screen.getByText("Test Track")).toBeInTheDocument();
      expect(screen.getByText("$2.99")).toBeInTheDocument();
    });
  });

  it("should have search functionality", async () => {
    render(<MarketplacePage />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
    
    const user = userEvent.setup();
    await user.type(searchInput, "meditation");
    
    // Debounced search should trigger after delay
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("search=meditation"),
        expect.any(Object)
      );
    }, { timeout: 1000 });
  });

  it("should have filter panel", async () => {
    render(<MarketplacePage />);
    
    // Check for filter elements
    expect(screen.getByText(/filters/i)).toBeInTheDocument();
    expect(screen.getByText(/price range/i)).toBeInTheDocument();
    expect(screen.getByText(/duration/i)).toBeInTheDocument();
  });

  it("should have sort dropdown", async () => {
    render(<MarketplacePage />);
    
    const sortDropdown = screen.getByLabelText(/sort by/i);
    expect(sortDropdown).toBeInTheDocument();
    
    const user = userEvent.setup();
    await user.selectOptions(sortDropdown, "price_low");
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("sort=price_low"),
        expect.any(Object)
      );
    });
  });

  it("should support infinite scroll", async () => {
    // Mock intersection observer
    const mockIntersectionObserver = vi.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    });
    window.IntersectionObserver = mockIntersectionObserver as any;
    
    render(<MarketplacePage />);
    
    await waitFor(() => {
      expect(screen.getByText("Test Track")).toBeInTheDocument();
    });
    
    // Check that intersection observer was set up
    expect(mockIntersectionObserver).toHaveBeenCalled();
  });

  it("should handle loading states", () => {
    render(<MarketplacePage />);
    
    // Should show loading indicators initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should handle error states", async () => {
    (global.fetch as any).mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Failed to load" }),
      })
    );
    
    render(<MarketplacePage />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("should filter by category when category is clicked", async () => {
    render(<MarketplacePage />);
    
    await waitFor(() => {
      expect(screen.getByText("Meditation")).toBeInTheDocument();
    });
    
    const user = userEvent.setup();
    await user.click(screen.getByText("Meditation"));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("category=meditation"),
        expect.any(Object)
      );
    });
  });

  it("should toggle between grid and list view", async () => {
    render(<MarketplacePage />);
    
    const gridButton = screen.getByLabelText(/grid view/i);
    const listButton = screen.getByLabelText(/list view/i);
    
    expect(gridButton).toBeInTheDocument();
    expect(listButton).toBeInTheDocument();
    
    const user = userEvent.setup();
    await user.click(listButton);
    
    // Check that layout changed
    await waitFor(() => {
      const container = screen.getByTestId("track-container");
      expect(container).toHaveClass("list-view");
    });
  });

  it("should clear filters", async () => {
    render(<MarketplacePage />);
    
    // Apply a filter first
    const user = userEvent.setup();
    await user.click(screen.getByText("Meditation"));
    
    // Clear filters
    const clearButton = screen.getByText(/clear filters/i);
    await user.click(clearButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining("category="),
        expect.any(Object)
      );
    });
  });
});
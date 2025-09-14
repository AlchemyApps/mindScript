import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingConfig } from './PricingConfig';
import { usePublishStore } from '@/store/publishStore';

// Mock the store
vi.mock('@/store/publishStore', () => ({
  usePublishStore: vi.fn(),
}));

describe('PricingConfig', () => {
  const mockStore = {
    pricing: {
      enableMarketplace: false,
      price: 0,
      promotional: false,
      promotionalPrice: null,
    },
    updatePricing: vi.fn(),
    getPlatformFee: vi.fn().mockReturnValue(0),
    getEstimatedEarnings: vi.fn().mockReturnValue(0),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePublishStore as any).mockReturnValue(mockStore);
  });

  it('should render marketplace toggle', () => {
    render(<PricingConfig />);
    
    expect(screen.getByLabelText(/enable marketplace listing/i)).toBeInTheDocument();
  });

  it('should toggle marketplace listing', async () => {
    render(<PricingConfig />);
    
    const toggle = screen.getByLabelText(/enable marketplace listing/i);
    await userEvent.click(toggle);
    
    expect(mockStore.updatePricing).toHaveBeenCalledWith({
      enableMarketplace: true,
    });
  });

  it('should show pricing fields when marketplace enabled', () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true, price: 9.99 },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    expect(screen.getByLabelText(/regular price/i)).toBeInTheDocument();
    expect(screen.getByText(/platform fee/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated earnings/i)).toBeInTheDocument();
  });

  it('should hide pricing fields when marketplace disabled', () => {
    render(<PricingConfig />);
    
    expect(screen.queryByLabelText(/regular price/i)).not.toBeInTheDocument();
  });

  it('should update price value', async () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true, price: 0 },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    const priceInput = screen.getByLabelText(/regular price/i);
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '19.99');
    
    await waitFor(() => {
      expect(mockStore.updatePricing).toHaveBeenCalledWith({
        price: 19.99,
      });
    });
  });

  it('should validate minimum price', async () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    const priceInput = screen.getByLabelText(/regular price/i);
    await userEvent.type(priceInput, '0.50');
    await userEvent.tab(); // Blur to trigger validation
    
    await waitFor(() => {
      expect(screen.getByText(/minimum price is \$0.99/i)).toBeInTheDocument();
    });
  });

  it('should validate maximum price', async () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    const priceInput = screen.getByLabelText(/regular price/i);
    await userEvent.type(priceInput, '99.99');
    await userEvent.tab();
    
    await waitFor(() => {
      expect(screen.getByText(/maximum price is \$49.99/i)).toBeInTheDocument();
    });
  });

  it('should toggle promotional pricing', async () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true, price: 19.99 },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    const promoToggle = screen.getByLabelText(/enable promotional pricing/i);
    await userEvent.click(promoToggle);
    
    expect(mockStore.updatePricing).toHaveBeenCalledWith({
      promotional: true,
    });
  });

  it('should show promotional price field when enabled', () => {
    const promoStore = {
      ...mockStore,
      pricing: { 
        ...mockStore.pricing, 
        enableMarketplace: true, 
        price: 19.99,
        promotional: true,
        promotionalPrice: 9.99,
      },
    };
    (usePublishStore as any).mockReturnValue(promoStore);
    
    render(<PricingConfig />);
    
    expect(screen.getByLabelText(/promotional price/i)).toBeInTheDocument();
  });

  it('should validate promotional price is less than regular price', async () => {
    const promoStore = {
      ...mockStore,
      pricing: { 
        ...mockStore.pricing, 
        enableMarketplace: true, 
        price: 10.00,
        promotional: true,
      },
    };
    (usePublishStore as any).mockReturnValue(promoStore);
    
    render(<PricingConfig />);
    
    const promoInput = screen.getByLabelText(/promotional price/i);
    await userEvent.type(promoInput, '15.00');
    await userEvent.tab();
    
    await waitFor(() => {
      expect(screen.getByText(/must be less than regular price/i)).toBeInTheDocument();
    });
  });

  it('should calculate and display platform fee', () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true, price: 10.00 },
      getPlatformFee: vi.fn().mockReturnValue(1.50),
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('(15%)')).toBeInTheDocument();
  });

  it('should calculate and display estimated earnings', () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true, price: 10.00 },
      getPlatformFee: vi.fn().mockReturnValue(1.50),
      getEstimatedEarnings: vi.fn().mockReturnValue(8.50),
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    expect(screen.getByText('$8.50')).toBeInTheDocument();
  });

  it('should use promotional price for calculations when active', () => {
    const promoStore = {
      ...mockStore,
      pricing: { 
        ...mockStore.pricing, 
        enableMarketplace: true, 
        price: 20.00,
        promotional: true,
        promotionalPrice: 10.00,
      },
      getPlatformFee: vi.fn().mockReturnValue(1.50), // 15% of $10
      getEstimatedEarnings: vi.fn().mockReturnValue(8.50), // $10 - $1.50
    };
    (usePublishStore as any).mockReturnValue(promoStore);
    
    render(<PricingConfig />);
    
    // Should show promotional price calculations
    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('$8.50')).toBeInTheDocument();
    
    // Should show strike-through regular price
    expect(screen.getByText('$20.00')).toHaveClass('line-through');
  });

  it('should show info tooltip for platform fee', async () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true, price: 10.00 },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    const infoIcon = screen.getByLabelText(/platform fee info/i);
    await userEvent.hover(infoIcon);
    
    await waitFor(() => {
      expect(screen.getByText(/15% platform fee/i)).toBeInTheDocument();
    });
  });

  it('should format price inputs correctly', async () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    const priceInput = screen.getByLabelText(/regular price/i);
    await userEvent.type(priceInput, '9.999'); // Should round to 2 decimals
    await userEvent.tab();
    
    await waitFor(() => {
      expect(mockStore.updatePricing).toHaveBeenCalledWith({
        price: 10.00, // Rounded up
      });
    });
  });

  it('should show suggested prices', () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    expect(screen.getByText('$4.99')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('$14.99')).toBeInTheDocument();
    expect(screen.getByText('$19.99')).toBeInTheDocument();
  });

  it('should apply suggested price on click', async () => {
    const enabledStore = {
      ...mockStore,
      pricing: { ...mockStore.pricing, enableMarketplace: true },
    };
    (usePublishStore as any).mockReturnValue(enabledStore);
    
    render(<PricingConfig />);
    
    const suggestedPrice = screen.getByText('$9.99');
    await userEvent.click(suggestedPrice);
    
    expect(mockStore.updatePricing).toHaveBeenCalledWith({
      price: 9.99,
    });
  });
});
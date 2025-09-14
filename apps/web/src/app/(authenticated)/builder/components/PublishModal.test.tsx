import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import { usePublishStore } from '@/store/publishStore';

// Mock the store
vi.mock('@/store/publishStore', () => ({
  usePublishStore: vi.fn(),
}));

// Mock the child components
vi.mock('./MetadataForm', () => ({
  MetadataForm: () => <div data-testid="metadata-form">Metadata Form</div>,
}));

vi.mock('./PricingConfig', () => ({
  PricingConfig: () => <div data-testid="pricing-config">Pricing Config</div>,
}));

vi.mock('./PublishPreview', () => ({
  PublishPreview: () => <div data-testid="publish-preview">Publish Preview</div>,
}));

vi.mock('./RenderProgress', () => ({
  RenderProgress: () => <div data-testid="render-progress">Render Progress</div>,
}));

describe('PublishModal', () => {
  const mockStore = {
    currentStep: 1,
    maxSteps: 5,
    metadata: {},
    pricing: {
      enableMarketplace: false,
      price: 0,
      promotional: false,
      promotionalPrice: null,
    },
    nextStep: vi.fn(),
    previousStep: vi.fn(),
    goToStep: vi.fn(),
    isStepValid: vi.fn().mockReturnValue(true),
    canProceed: vi.fn().mockReturnValue(true),
    reset: vi.fn(),
    saveDraft: vi.fn(),
    setTrackData: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePublishStore as any).mockReturnValue(mockStore);
  });

  it('should render the modal when open', () => {
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    expect(screen.getByText('Publish Track')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-form')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<PublishModal isOpen={false} onClose={vi.fn()} trackData={{}} />);
    
    expect(screen.queryByText('Publish Track')).not.toBeInTheDocument();
  });

  it('should display step indicators', () => {
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    expect(screen.getByText('1. Metadata')).toBeInTheDocument();
    expect(screen.getByText('2. Settings')).toBeInTheDocument();
    expect(screen.getByText('3. Pricing')).toBeInTheDocument();
    expect(screen.getByText('4. Preview')).toBeInTheDocument();
    expect(screen.getByText('5. Publish')).toBeInTheDocument();
  });

  it('should highlight current step', () => {
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    const step1 = screen.getByText('1. Metadata').closest('button');
    expect(step1).toHaveClass('active');
  });

  it('should navigate to next step', async () => {
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    const nextButton = screen.getByText('Next');
    await userEvent.click(nextButton);
    
    expect(mockStore.nextStep).toHaveBeenCalled();
  });

  it('should navigate to previous step', async () => {
    const storeWithStep2 = { ...mockStore, currentStep: 2 };
    (usePublishStore as any).mockReturnValue(storeWithStep2);
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    const backButton = screen.getByText('Back');
    await userEvent.click(backButton);
    
    expect(mockStore.previousStep).toHaveBeenCalled();
  });

  it('should disable Back button on first step', () => {
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    const backButton = screen.getByText('Back');
    expect(backButton).toBeDisabled();
  });

  it('should disable Next button when step is invalid', () => {
    const invalidStore = { ...mockStore, canProceed: vi.fn().mockReturnValue(false) };
    (usePublishStore as any).mockReturnValue(invalidStore);
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should show correct component for each step', () => {
    // Step 1: Metadata
    const { rerender } = render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    expect(screen.getByTestId('metadata-form')).toBeInTheDocument();
    
    // Step 2: Category & Settings (still metadata form)
    (usePublishStore as any).mockReturnValue({ ...mockStore, currentStep: 2 });
    rerender(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    expect(screen.getByTestId('metadata-form')).toBeInTheDocument();
    
    // Step 3: Pricing
    (usePublishStore as any).mockReturnValue({ ...mockStore, currentStep: 3 });
    rerender(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    expect(screen.getByTestId('pricing-config')).toBeInTheDocument();
    
    // Step 4: Preview
    (usePublishStore as any).mockReturnValue({ ...mockStore, currentStep: 4 });
    rerender(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    expect(screen.getByTestId('publish-preview')).toBeInTheDocument();
    
    // Step 5: Render Progress
    (usePublishStore as any).mockReturnValue({ ...mockStore, currentStep: 5 });
    rerender(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    expect(screen.getByTestId('render-progress')).toBeInTheDocument();
  });

  it('should show "Publish" button on preview step', () => {
    (usePublishStore as any).mockReturnValue({ ...mockStore, currentStep: 4 });
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('should handle close button', async () => {
    const onClose = vi.fn();
    render(<PublishModal isOpen={true} onClose={onClose} trackData={{}} />);
    
    const closeButton = screen.getByLabelText('Close');
    await userEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should save draft on close', async () => {
    const onClose = vi.fn();
    render(<PublishModal isOpen={true} onClose={onClose} trackData={{}} />);
    
    const closeButton = screen.getByLabelText('Close');
    await userEvent.click(closeButton);
    
    expect(mockStore.saveDraft).toHaveBeenCalled();
  });

  it('should set track data on mount', () => {
    const trackData = { 
      script: 'Test script',
      voice_config: { provider: 'openai', voice_id: 'nova' }
    };
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={trackData} />);
    
    expect(mockStore.setTrackData).toHaveBeenCalledWith(trackData);
  });

  it('should allow jumping to step by clicking step indicator', async () => {
    (usePublishStore as any).mockReturnValue({ 
      ...mockStore, 
      currentStep: 4,
      isStepValid: vi.fn().mockImplementation((step) => step <= 3)
    });
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    const step2Button = screen.getByText('2. Settings');
    await userEvent.click(step2Button);
    
    expect(mockStore.goToStep).toHaveBeenCalledWith(2);
  });

  it('should not allow jumping to invalid steps', async () => {
    (usePublishStore as any).mockReturnValue({ 
      ...mockStore, 
      currentStep: 1,
      isStepValid: vi.fn().mockReturnValue(false)
    });
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} />);
    
    const step3Button = screen.getByText('3. Pricing');
    expect(step3Button).toBeDisabled();
  });

  it('should handle publish action on step 4', async () => {
    const onPublish = vi.fn();
    (usePublishStore as any).mockReturnValue({ ...mockStore, currentStep: 4 });
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} onPublish={onPublish} />);
    
    const publishButton = screen.getByText('Publish');
    await userEvent.click(publishButton);
    
    await waitFor(() => {
      expect(onPublish).toHaveBeenCalled();
    });
  });

  it('should show loading state during publish', async () => {
    const onPublish = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    (usePublishStore as any).mockReturnValue({ ...mockStore, currentStep: 4 });
    
    render(<PublishModal isOpen={true} onClose={vi.fn()} trackData={{}} onPublish={onPublish} />);
    
    const publishButton = screen.getByText('Publish');
    await userEvent.click(publishButton);
    
    expect(screen.getByText('Publishing...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText('Publishing...')).not.toBeInTheDocument();
    });
  });
});
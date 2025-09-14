import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePublishStore } from './publishStore';

describe('publishStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => usePublishStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('Step Management', () => {
    it('should initialize with step 1', () => {
      const { result } = renderHook(() => usePublishStore());
      expect(result.current.currentStep).toBe(1);
    });

    it('should navigate to next step', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('should navigate to previous step', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.setCurrentStep(3);
        result.current.previousStep();
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('should not go below step 1', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.previousStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should not go above max steps', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.setCurrentStep(5);
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(5);
    });

    it('should jump to specific step', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.goToStep(3);
      });

      expect(result.current.currentStep).toBe(3);
    });
  });

  describe('Metadata Management', () => {
    it('should update metadata', () => {
      const { result } = renderHook(() => usePublishStore());
      
      const metadata = {
        title: 'Test Track',
        description: 'Test Description',
        tags: ['meditation', 'sleep'],
        category: 'Meditation' as const,
        visibility: 'public' as const,
      };

      act(() => {
        result.current.updateMetadata(metadata);
      });

      expect(result.current.metadata).toEqual(metadata);
    });

    it('should handle partial metadata updates', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.updateMetadata({ title: 'Initial Title' });
        result.current.updateMetadata({ description: 'Added Description' });
      });

      expect(result.current.metadata.title).toBe('Initial Title');
      expect(result.current.metadata.description).toBe('Added Description');
    });
  });

  describe('Pricing Configuration', () => {
    it('should update pricing config', () => {
      const { result } = renderHook(() => usePublishStore());
      
      const pricing = {
        enableMarketplace: true,
        price: 9.99,
        promotional: false,
        promotionalPrice: null,
      };

      act(() => {
        result.current.updatePricing(pricing);
      });

      expect(result.current.pricing).toEqual(pricing);
    });

    it('should calculate platform fee correctly', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.updatePricing({
          enableMarketplace: true,
          price: 10.00,
          promotional: false,
          promotionalPrice: null,
        });
      });

      expect(result.current.getPlatformFee()).toBe(1.50); // 15% of $10
      expect(result.current.getEstimatedEarnings()).toBe(8.50); // $10 - $1.50
    });

    it('should use promotional price for calculations when active', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.updatePricing({
          enableMarketplace: true,
          price: 20.00,
          promotional: true,
          promotionalPrice: 10.00,
        });
      });

      expect(result.current.getPlatformFee()).toBe(1.50); // 15% of $10
      expect(result.current.getEstimatedEarnings()).toBe(8.50); // $10 - $1.50
    });
  });

  describe('Render Progress', () => {
    it('should update render progress', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.updateRenderProgress({
          percentage: 50,
          stage: 'mixing',
          message: 'Mixing audio layers...',
        });
      });

      expect(result.current.renderProgress.percentage).toBe(50);
      expect(result.current.renderProgress.stage).toBe('mixing');
      expect(result.current.renderProgress.message).toBe('Mixing audio layers...');
    });

    it('should set job ID', () => {
      const { result } = renderHook(() => usePublishStore());
      const jobId = 'job-123';
      
      act(() => {
        result.current.setJobId(jobId);
      });

      expect(result.current.jobId).toBe(jobId);
    });

    it('should handle render error', () => {
      const { result } = renderHook(() => usePublishStore());
      const error = 'Failed to process audio';
      
      act(() => {
        result.current.setRenderError(error);
      });

      expect(result.current.renderError).toBe(error);
    });
  });

  describe('Validation', () => {
    it('should validate step 1 (metadata)', () => {
      const { result } = renderHook(() => usePublishStore());
      
      // Invalid - missing required fields
      expect(result.current.isStepValid(1)).toBe(false);
      
      act(() => {
        result.current.updateMetadata({
          title: 'Valid Title',
          category: 'Meditation',
          visibility: 'public',
        });
      });

      // Valid - has required fields
      expect(result.current.isStepValid(1)).toBe(true);
    });

    it('should validate step 3 (pricing)', () => {
      const { result } = renderHook(() => usePublishStore());
      
      // Valid when marketplace disabled
      act(() => {
        result.current.updatePricing({
          enableMarketplace: false,
          price: 0,
          promotional: false,
          promotionalPrice: null,
        });
      });
      expect(result.current.isStepValid(3)).toBe(true);

      // Invalid when marketplace enabled but price out of range
      act(() => {
        result.current.updatePricing({
          enableMarketplace: true,
          price: 0.50, // Below minimum
          promotional: false,
          promotionalPrice: null,
        });
      });
      expect(result.current.isStepValid(3)).toBe(false);

      // Valid when price in range
      act(() => {
        result.current.updatePricing({
          enableMarketplace: true,
          price: 9.99,
          promotional: false,
          promotionalPrice: null,
        });
      });
      expect(result.current.isStepValid(3)).toBe(true);
    });
  });

  describe('Draft Management', () => {
    it('should save draft to localStorage', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.updateMetadata({
          title: 'Draft Track',
          description: 'Draft Description',
        });
        result.current.saveDraft();
      });

      const draft = localStorage.getItem('publish-draft');
      expect(draft).toBeTruthy();
      const parsedDraft = JSON.parse(draft!);
      expect(parsedDraft.metadata.title).toBe('Draft Track');
    });

    it('should load draft from localStorage', () => {
      const draft = {
        currentStep: 2,
        metadata: {
          title: 'Loaded Draft',
          description: 'Loaded Description',
        },
        pricing: {
          enableMarketplace: true,
          price: 15.99,
        },
      };

      localStorage.setItem('publish-draft', JSON.stringify(draft));

      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.loadDraft();
      });

      expect(result.current.currentStep).toBe(2);
      expect(result.current.metadata.title).toBe('Loaded Draft');
      expect(result.current.pricing.price).toBe(15.99);
    });

    it('should clear draft', () => {
      localStorage.setItem('publish-draft', JSON.stringify({ test: 'data' }));
      
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.clearDraft();
      });

      expect(localStorage.getItem('publish-draft')).toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset store to initial state', () => {
      const { result } = renderHook(() => usePublishStore());
      
      act(() => {
        result.current.setCurrentStep(3);
        result.current.updateMetadata({ title: 'Test' });
        result.current.updatePricing({ price: 10.00 });
        result.current.setJobId('job-123');
        result.current.reset();
      });

      expect(result.current.currentStep).toBe(1);
      expect(result.current.metadata).toEqual({});
      expect(result.current.pricing).toEqual({
        enableMarketplace: false,
        price: 0,
        promotional: false,
        promotionalPrice: null,
      });
      expect(result.current.jobId).toBeNull();
    });
  });
});
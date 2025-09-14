import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type Category = 'Meditation' | 'Sleep' | 'Focus' | 'Relaxation' | 'Energy' | 'Healing';
export type Visibility = 'public' | 'private';
export type RenderStage = 'preparing' | 'tts' | 'mixing' | 'normalizing' | 'uploading' | 'completed';

interface Metadata {
  title?: string;
  description?: string;
  tags?: string[];
  category?: Category;
  visibility?: Visibility;
}

interface PricingConfig {
  enableMarketplace: boolean;
  price: number;
  promotional: boolean;
  promotionalPrice: number | null;
}

interface RenderProgress {
  percentage: number;
  stage: RenderStage | null;
  message: string;
  estimatedTimeRemaining?: number;
}

interface PublishState {
  // Step management
  currentStep: number;
  maxSteps: number;
  
  // Form data
  metadata: Metadata;
  pricing: PricingConfig;
  
  // Render state
  jobId: string | null;
  renderProgress: RenderProgress;
  renderError: string | null;
  
  // Track data from builder
  trackData: any | null; // Will be populated from builder
  
  // Actions
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  setCurrentStep: (step: number) => void;
  
  // Data updates
  updateMetadata: (metadata: Partial<Metadata>) => void;
  updatePricing: (pricing: Partial<PricingConfig>) => void;
  setTrackData: (data: any) => void;
  
  // Render actions
  setJobId: (jobId: string) => void;
  updateRenderProgress: (progress: Partial<RenderProgress>) => void;
  setRenderError: (error: string) => void;
  
  // Calculations
  getPlatformFee: () => number;
  getEstimatedEarnings: () => number;
  
  // Validation
  isStepValid: (step: number) => boolean;
  canProceed: () => boolean;
  
  // Draft management
  saveDraft: () => void;
  loadDraft: () => void;
  clearDraft: () => void;
  
  // Reset
  reset: () => void;
}

const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee
const MIN_PRICE = 0.99;
const MAX_PRICE = 49.99;
const DRAFT_KEY = 'publish-draft';

const initialState = {
  currentStep: 1,
  maxSteps: 5,
  metadata: {},
  pricing: {
    enableMarketplace: false,
    price: 0,
    promotional: false,
    promotionalPrice: null,
  },
  jobId: null,
  renderProgress: {
    percentage: 0,
    stage: null,
    message: '',
  },
  renderError: null,
  trackData: null,
};

export const usePublishStore = create<PublishState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Step navigation
        nextStep: () => {
          const { currentStep, maxSteps, canProceed } = get();
          if (currentStep < maxSteps && canProceed()) {
            set({ currentStep: currentStep + 1 });
          }
        },

        previousStep: () => {
          const { currentStep } = get();
          if (currentStep > 1) {
            set({ currentStep: currentStep - 1 });
          }
        },

        goToStep: (step: number) => {
          const { maxSteps } = get();
          if (step >= 1 && step <= maxSteps) {
            set({ currentStep: step });
          }
        },

        setCurrentStep: (step: number) => {
          set({ currentStep: step });
        },

        // Data updates
        updateMetadata: (metadata: Partial<Metadata>) => {
          set((state) => ({
            metadata: { ...state.metadata, ...metadata },
          }));
        },

        updatePricing: (pricing: Partial<PricingConfig>) => {
          set((state) => ({
            pricing: { ...state.pricing, ...pricing },
          }));
        },

        setTrackData: (data: any) => {
          set({ trackData: data });
        },

        // Render actions
        setJobId: (jobId: string) => {
          set({ jobId });
        },

        updateRenderProgress: (progress: Partial<RenderProgress>) => {
          set((state) => ({
            renderProgress: { ...state.renderProgress, ...progress },
          }));
        },

        setRenderError: (error: string) => {
          set({ renderError: error });
        },

        // Calculations
        getPlatformFee: () => {
          const { pricing } = get();
          if (!pricing.enableMarketplace) return 0;
          
          const activePrice = pricing.promotional && pricing.promotionalPrice 
            ? pricing.promotionalPrice 
            : pricing.price;
          
          return Number((activePrice * PLATFORM_FEE_PERCENTAGE).toFixed(2));
        },

        getEstimatedEarnings: () => {
          const { pricing, getPlatformFee } = get();
          if (!pricing.enableMarketplace) return 0;
          
          const activePrice = pricing.promotional && pricing.promotionalPrice 
            ? pricing.promotionalPrice 
            : pricing.price;
          
          return Number((activePrice - getPlatformFee()).toFixed(2));
        },

        // Validation
        isStepValid: (step: number) => {
          const state = get();
          
          switch (step) {
            case 1: // Metadata
              return !!(
                state.metadata.title &&
                state.metadata.title.length >= 3 &&
                state.metadata.title.length <= 100 &&
                state.metadata.category &&
                state.metadata.visibility
              );
              
            case 2: // Category & Settings (validated in step 1)
              return true;
              
            case 3: // Pricing
              if (!state.pricing.enableMarketplace) return true;
              
              const activePrice = state.pricing.promotional && state.pricing.promotionalPrice
                ? state.pricing.promotionalPrice
                : state.pricing.price;
              
              return activePrice >= MIN_PRICE && activePrice <= MAX_PRICE;
              
            case 4: // Preview
              return true; // No validation needed for preview
              
            case 5: // Render
              return !!state.jobId; // Must have a job ID
              
            default:
              return false;
          }
        },

        canProceed: () => {
          const { currentStep, isStepValid } = get();
          return isStepValid(currentStep);
        },

        // Draft management
        saveDraft: () => {
          const { currentStep, metadata, pricing, trackData } = get();
          const draft = {
            currentStep,
            metadata,
            pricing,
            trackData,
            timestamp: Date.now(),
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        },

        loadDraft: () => {
          const draftStr = localStorage.getItem(DRAFT_KEY);
          if (draftStr) {
            try {
              const draft = JSON.parse(draftStr);
              set({
                currentStep: draft.currentStep || 1,
                metadata: draft.metadata || {},
                pricing: draft.pricing || initialState.pricing,
                trackData: draft.trackData || null,
              });
            } catch (error) {
              console.error('Failed to load draft:', error);
            }
          }
        },

        clearDraft: () => {
          localStorage.removeItem(DRAFT_KEY);
        },

        // Reset
        reset: () => {
          set(initialState);
        },
      }),
      {
        name: 'publish-store',
        partialize: (state) => ({
          // Only persist non-sensitive data
          currentStep: state.currentStep,
          metadata: state.metadata,
          pricing: state.pricing,
        }),
      }
    ),
    {
      name: 'PublishStore',
    }
  )
);
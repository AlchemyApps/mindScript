'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@mindscript/ui';
import { cn } from '../../lib/utils';
import { StepIndicator, type Step } from './StepIndicator';
import { IntentionStep, type IntentionCategory } from './steps/IntentionStep';
import { ScriptStep } from './steps/ScriptStep';
import { VoiceStep, type VoiceProvider, type VoiceSelection } from './steps/VoiceStep';
import { EnhanceStep, type BinauralBand } from './steps/EnhanceStep';
import { CreateStep } from './steps/CreateStep';
import { AuthModal } from '../auth-modal';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { VoiceCloneShelf } from './VoiceCloneShelf';
import { VoiceCloneCTA } from './VoiceCloneCTA';

const STEPS: Step[] = [
  { id: 'intention', label: 'Intention' },
  { id: 'script', label: 'Script' },
  { id: 'voice', label: 'Voice' },
  { id: 'enhance', label: 'Enhance' },
  { id: 'create', label: 'Create' },
];

interface BuilderState {
  intention: IntentionCategory | null;
  title: string;
  script: string;
  voice: VoiceSelection;
  duration: number;
  loop: {
    enabled: boolean;
    pause_seconds: number;
  };
  music?: {
    id: string;
    name: string;
    price: number;
  };
  solfeggio?: {
    enabled: boolean;
    frequency: number;
    price: number;
  };
  binaural?: {
    enabled: boolean;
    band: BinauralBand;
    price: number;
  };
}

const DEFAULT_STATE: BuilderState = {
  intention: null,
  title: '',
  script: '',
  voice: {
    provider: 'openai',
    voice_id: 'alloy',
    name: 'Alloy',
  },
  duration: 5,
  loop: {
    enabled: true,
    pause_seconds: 5,
  },
  music: undefined,
  solfeggio: undefined,
  binaural: undefined,
};

interface StepBuilderProps {
  className?: string;
  variant?: 'card' | 'full';
}

export function StepBuilder({ className, variant = 'card' }: StepBuilderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<BuilderState>(DEFAULT_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [supabaseClient, setSupabaseClient] = useState<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const [showCloneShelf, setShowCloneShelf] = useState(false);
  const [hasClonedVoice, setHasClonedVoice] = useState(false);
  const [pricingInfo, setPricingInfo] = useState({
    basePrice: 2.99,
    discountedPrice: 0.99,
    savings: 2.00,
    isEligibleForDiscount: true,
    ffTier: null as string | null,
  });

  // Initialize Supabase client
  useEffect(() => {
    try {
      const client = getSupabaseBrowserClient();
      setSupabaseClient(client);
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
    }
  }, []);

  // Check auth status
  const checkAuthStatus = useCallback(async () => {
    if (!supabaseClient) return;
    try {
      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      setUser(currentUser);
      if (currentUser) {
        await checkPricingEligibility();
        // Check if user has any custom cloned voices
        try {
          const res = await fetch('/api/voices?includeCustom=true');
          if (res.ok) {
            const data = await res.json();
            setHasClonedVoice((data.voicesByTier?.custom?.length ?? 0) > 0);
          }
        } catch {
          // Non-critical — leave as false
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  }, [supabaseClient]);

  const checkPricingEligibility = async () => {
    try {
      const response = await fetch('/api/pricing/check-eligibility');
      if (response.ok) {
        const data = await response.json();
        setPricingInfo({
          basePrice: data.pricing.basePrice / 100,
          discountedPrice: data.pricing.discountedPrice / 100,
          savings: data.pricing.savings / 100,
          isEligibleForDiscount: data.isEligibleForDiscount,
          ffTier: data.ffTier || null,
        });
      }
    } catch (error) {
      console.error('Error checking pricing:', error);
    }
  };

  // Load saved state and check auth
  useEffect(() => {
    setIsHydrated(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stepBuilderState');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setState((prev) => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Failed to parse saved state:', e);
        }
      }
    }
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Save state on change
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem('stepBuilderState', JSON.stringify(state));
    }
  }, [state, isHydrated]);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return state.intention !== null;
      case 1:
        return state.title.trim().length >= 3 && state.script.length >= 10;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleIntentionSelect = (intention: IntentionCategory, suggestion: string) => {
    setState((prev) => ({
      ...prev,
      intention,
      script: suggestion || prev.script,
    }));
    // Auto-advance after selection
    setTimeout(() => setCurrentStep(1), 300);
  };

  const handleCheckout = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    await proceedWithCheckout(user);
  };

  const proceedWithCheckout = async (checkoutUser: any) => {
    setIsProcessing(true);
    try {
      const total = calculateTotal();
      const checkoutData = {
        userId: checkoutUser.id || checkoutUser.email,
        builderState: {
          title: state.title || 'Custom Track',
          script: state.script,
          voice: {
            provider: state.voice.provider,
            voice_id: state.voice.voice_id,
            name: state.voice.name,
            tier: state.voice.tier,
            internalCode: state.voice.internalCode,
            settings: {},
          },
          music: state.music && state.music.id !== 'none'
            ? { id: state.music.id, volume_db: -10 }
            : undefined,
          solfeggio: state.solfeggio?.enabled
            ? { enabled: true, frequency: state.solfeggio.frequency, volume_db: -16 }
            : undefined,
          binaural: state.binaural?.enabled
            ? { enabled: true, band: state.binaural.band, volume_db: -18 }
            : undefined,
          duration: state.duration,
          loop: state.loop,
        },
        successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href,
        priceAmount: Math.round(total * 100),
        firstTrackDiscount: pricingInfo.isEligibleForDiscount,
      };

      const response = await fetch('/api/checkout/guest-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();

      // F&F users may skip Stripe entirely
      if (data.skipStripe && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthSuccess = async (authenticatedUser: any) => {
    let resolvedUser = authenticatedUser;
    if (!resolvedUser && supabaseClient) {
      const { data } = await supabaseClient.auth.getUser();
      resolvedUser = data.user;
    }
    if (resolvedUser) {
      setUser(resolvedUser);
      setShowAuthModal(false);
      await checkPricingEligibility();
      await proceedWithCheckout(resolvedUser);
    }
  };

  const calculateTotal = () => {
    // F&F inner_circle gets everything free
    if (pricingInfo.ffTier === 'inner_circle') return 0;

    let total = pricingInfo.isEligibleForDiscount ? pricingInfo.discountedPrice : pricingInfo.basePrice;

    // F&F cost_pass only pays AI COGS (calculated server-side at checkout), no add-on fees
    if (pricingInfo.ffTier === 'cost_pass') return total;

    if (state.music && state.music.id !== 'none') {
      total += state.music.price;
    }
    if (state.solfeggio?.enabled) {
      total += state.solfeggio.price;
    }
    if (state.binaural?.enabled) {
      total += state.binaural.price;
    }
    return total;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <IntentionStep
            selectedIntention={state.intention}
            onSelect={handleIntentionSelect}
          />
        );
      case 1:
        return (
          <ScriptStep
            title={state.title}
            script={state.script}
            intention={state.intention}
            onTitleChange={(title) => setState((prev) => ({ ...prev, title }))}
            onScriptChange={(script) => setState((prev) => ({ ...prev, script }))}
          />
        );
      case 2:
        return (
          <VoiceStep
            selectedVoice={state.voice}
            duration={state.duration}
            loopEnabled={state.loop.enabled}
            loopPause={state.loop.pause_seconds}
            scriptLength={state.script.length}
            isAuthenticated={!!user}
            isFF={pricingInfo.ffTier === 'inner_circle' || pricingInfo.ffTier === 'cost_pass'}
            onVoiceChange={(voice) => setState((prev) => ({ ...prev, voice }))}
            onDurationChange={(duration) => setState((prev) => ({ ...prev, duration }))}
            onLoopChange={(enabled, pause) =>
              setState((prev) => ({
                ...prev,
                loop: { enabled, pause_seconds: pause },
              }))
            }
            onOpenVoiceClone={() => setShowCloneShelf(true)}
          />
        );
      case 3:
        return (
          <EnhanceStep
            solfeggio={state.solfeggio}
            binaural={state.binaural}
            music={state.music}
            onSolfeggioChange={(solfeggio) => setState((prev) => ({ ...prev, solfeggio }))}
            onBinauralChange={(binaural) => setState((prev) => ({ ...prev, binaural }))}
            onMusicChange={(music) => setState((prev) => ({ ...prev, music }))}
          />
        );
      case 4:
        return (
          <CreateStep
            title={state.title}
            script={state.script}
            intention={state.intention}
            voice={state.voice}
            duration={state.duration}
            loopEnabled={state.loop.enabled}
            solfeggio={state.solfeggio}
            binaural={state.binaural}
            music={state.music}
            pricingInfo={pricingInfo}
            isProcessing={isProcessing}
            user={user}
            onCheckout={handleCheckout}
          />
        );
      default:
        return null;
    }
  };

  const isCard = variant === 'card';
  const isFull = variant === 'full';

  // Full-page variant with vertical step indicator
  if (isFull) {
    return (
      <div className={cn('container mx-auto px-4 py-8', className)}>
          <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
            {/* Vertical Step Indicator (desktop only) */}
            <aside className="hidden lg:block">
              <GlassCard hover="none" className="sticky top-8">
                <h3 className="text-lg font-semibold mb-6">
                  <span className="text-gradient">Build Your Track</span>
                </h3>
                <StepIndicator
                  steps={STEPS}
                  currentStep={currentStep}
                  orientation="vertical"
                  onStepClick={(step) => step < currentStep && setCurrentStep(step)}
                />

                {/* Sidebar Voice Clone CTA */}
                {user && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <VoiceCloneCTA
                      variant="sidebar"
                      hasClonedVoice={hasClonedVoice}
                      isFF={pricingInfo.ffTier === 'inner_circle' || pricingInfo.ffTier === 'cost_pass'}
                      onClick={() => setShowCloneShelf(true)}
                    />
                  </div>
                )}
              </GlassCard>
            </aside>

            {/* Main Content */}
            <main>
              {/* Mobile Step Indicator */}
              <div className="lg:hidden mb-6">
                <GlassCard hover="none" noPadding className="p-4">
                  <StepIndicator
                    steps={STEPS}
                    currentStep={currentStep}
                    orientation="horizontal"
                    onStepClick={(step) => step < currentStep && setCurrentStep(step)}
                  />
                </GlassCard>
              </div>

              {/* Step Content */}
              <GlassCard hover="none" className="mb-6">
                <div className="animate-fade-in">{renderStep()}</div>
              </GlassCard>

              {/* Navigation */}
              {currentStep < 4 && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className={cn(
                      'glass',
                      currentStep === 0 && 'invisible'
                    )}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>

                  <GradientButton
                    onClick={handleNext}
                    disabled={!canProceed()}
                    glow
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </GradientButton>
                </div>
              )}
            </main>
          </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={handleAuthSuccess}
          mode="signup"
          title="Create Your Track"
          description={`Sign up to create your personalized audio track ${
            pricingInfo.isEligibleForDiscount
              ? `with special first-time pricing - only $${pricingInfo.discountedPrice.toFixed(2)}!`
              : `for $${pricingInfo.basePrice.toFixed(2)}`
          }`}
        />

        {/* Voice Clone Shelf */}
        <VoiceCloneShelf
          isOpen={showCloneShelf}
          onClose={() => setShowCloneShelf(false)}
          onComplete={() => {
            setShowCloneShelf(false);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  // Card variant (default - for landing page)
  return (
    <div
      className={cn(
        'glass rounded-2xl shadow-lg overflow-hidden',
        className
      )}
    >
      {/* Step Indicator */}
      <div className="px-6 pt-6">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          orientation="horizontal"
          onStepClick={(step) => step < currentStep && setCurrentStep(step)}
        />
      </div>

      {/* Step Content */}
      <div className="p-6">
        <div className="animate-fade-in">{renderStep()}</div>
      </div>

      {/* Navigation */}
      {currentStep < 4 && (
        <div className="flex items-center justify-between px-6 pb-6 pt-2 border-t border-gray-100">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={cn(currentStep === 0 && 'invisible')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <GradientButton
            onClick={handleNext}
            disabled={!canProceed()}
            glow
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </GradientButton>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthSuccess}
        mode="signup"
        title="Create Your Track"
        description={`Sign up to create your personalized audio track ${
          pricingInfo.isEligibleForDiscount
            ? `with special first-time pricing - only $${pricingInfo.discountedPrice.toFixed(2)}!`
            : `for $${pricingInfo.basePrice.toFixed(2)}`
        }`}
      />

      {/* Voice Clone Shelf */}
      <VoiceCloneShelf
        isOpen={showCloneShelf}
        onClose={() => setShowCloneShelf(false)}
        onComplete={() => {
          setShowCloneShelf(false);
          window.location.reload();
        }}
      />
    </div>
  );
}

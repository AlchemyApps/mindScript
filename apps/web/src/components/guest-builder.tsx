'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@mindscript/ui";
import { cn } from '../lib/utils';
import { AuthModal } from './auth-modal';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

interface BuilderState {
  title: string;
  script: string;
  voice: {
    provider: 'openai' | 'elevenlabs';
    voice_id: string;
    name: string;
  };
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
    band: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
    price: number;
  };
}

const VOICE_OPTIONS = {
  openai: [
    { id: 'alloy', name: 'Alloy (Neutral)' },
    { id: 'echo', name: 'Echo (Male)' },
    { id: 'fable', name: 'Fable (British)' },
    { id: 'onyx', name: 'Onyx (Deep Male)' },
    { id: 'nova', name: 'Nova (Female)' },
    { id: 'shimmer', name: 'Shimmer (Soft Female)' },
  ],
  elevenlabs: [
    { id: 'rachel', name: 'Rachel (Natural)' },
    { id: 'domi', name: 'Domi (Strong)' },
    { id: 'bella', name: 'Bella (Soft)' },
  ]
};

const BACKGROUND_MUSIC_OPTIONS = [
  { id: 'none', name: 'No Background Music', price: 0 },
  { id: 'calm-waters', name: 'Calm Waters', price: 0.99 },
  { id: 'forest-ambience', name: 'Forest Ambience', price: 0.99 },
  { id: 'cosmic-journey', name: 'Cosmic Journey', price: 0.99 },
  { id: 'meditation-bells', name: 'Meditation Bells', price: 0.99 },
];

const SOLFEGGIO_FREQUENCIES = [
  { value: 174, name: '174 Hz - Pain Relief' },
  { value: 285, name: '285 Hz - Healing' },
  { value: 396, name: '396 Hz - Liberation' },
  { value: 417, name: '417 Hz - Change' },
  { value: 528, name: '528 Hz - Love' },
  { value: 639, name: '639 Hz - Connection' },
  { value: 741, name: '741 Hz - Awakening' },
  { value: 852, name: '852 Hz - Intuition' },
  { value: 963, name: '963 Hz - Divine' },
];

const BINAURAL_BANDS = [
  { id: 'delta', name: 'Delta (0.5-4 Hz) - Deep Sleep', price: 0.99 },
  { id: 'theta', name: 'Theta (4-8 Hz) - Meditation', price: 0.99 },
  { id: 'alpha', name: 'Alpha (8-13 Hz) - Relaxation', price: 0.99 },
  { id: 'beta', name: 'Beta (13-30 Hz) - Focus', price: 0.99 },
  { id: 'gamma', name: 'Gamma (30-100 Hz) - Peak Awareness', price: 0.99 },
];

interface GuestBuilderProps {
  className?: string;
}

const DURATION_OPTIONS = [5, 10, 15] as const;

const DEFAULT_BUILDER_STATE: BuilderState = {
  title: '',
  script: '',
  voice: {
    provider: 'openai',
    voice_id: 'alloy',
    name: 'Alloy (Neutral)',
  },
  duration: 5,
  loop: {
    enabled: true,
    pause_seconds: 5,
  },
  music: undefined,
  solfeggio: {
    enabled: false,
    frequency: 528,
    price: 0.99,
  },
  binaural: {
    enabled: false,
    band: 'alpha',
    price: 0.99,
  },
};

export function GuestBuilder({ className }: GuestBuilderProps) {
  const [state, setState] = useState<BuilderState>(DEFAULT_BUILDER_STATE);

  const [activeTab, setActiveTab] = useState<'script' | 'voice' | 'extras'>('script');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [pricingInfo, setPricingInfo] = useState<{
    basePrice: number;
    discountedPrice: number;
    savings: number;
    isEligibleForDiscount: boolean;
  }>({ basePrice: 2.99, discountedPrice: 0.99, savings: 2.00, isEligibleForDiscount: true });
  const [supabaseClient, setSupabaseClient] = useState<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const client = getSupabaseBrowserClient();
      setSupabaseClient(client);
      setSupabaseError(null);
    } catch (error) {
      console.error('GuestBuilder: failed to initialize Supabase client', error);
      setSupabaseError(
        error instanceof Error
          ? error.message
          : 'Authentication service is unavailable. Verify Supabase configuration.'
      );
      setSupabaseClient(null);
    }
  }, []);

  const checkPricingEligibility = useCallback(async () => {
    try {
      const response = await fetch('/api/pricing/check-eligibility');
      if (!response.ok) {
        throw new Error('Failed to check pricing');
      }

      const pricingData = await response.json();

      // Update pricing display
      setPricingInfo({
        basePrice: pricingData.pricing.basePrice / 100, // Convert cents to dollars
        discountedPrice: pricingData.pricing.discountedPrice / 100,
        savings: pricingData.pricing.savings / 100,
        isEligibleForDiscount: pricingData.isEligibleForDiscount
      });

      // Alert user if they already used their discount
      if (!pricingData.isEligibleForDiscount) {
        alert(
          "You've already used your first-track discount.\n\n" +
          "Regular pricing ($2.99) applies, but you can still create amazing tracks!"
        );
      }
    } catch (error) {
      console.error('Error checking pricing:', error);
      // On error, still proceed but show message
      alert('Unable to verify pricing. Please contact support if you encounter issues.');
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    if (!supabaseClient) return;
    try {
      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      setUser(currentUser);

      // If user is already authenticated, check pricing now
      if (currentUser) {
        await checkPricingEligibility();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  }, [supabaseClient, checkPricingEligibility]);

  // Load from localStorage and check auth status after mount (NOT pricing)
  useEffect(() => {
    setIsHydrated(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('guestBuilderState');
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          setState({
            ...DEFAULT_BUILDER_STATE,
            ...parsedState,
            voice: {
              ...DEFAULT_BUILDER_STATE.voice,
              ...(parsedState.voice || {}),
            },
            loop: {
              ...DEFAULT_BUILDER_STATE.loop,
              ...(parsedState.loop || {}),
            },
            music: parsedState.music ?? (parsedState.backgroundMusic || parsedState.music ? {
              ...(parsedState.backgroundMusic || parsedState.music),
            } : undefined),
            solfeggio: parsedState.solfeggio
              ? { ...DEFAULT_BUILDER_STATE.solfeggio!, ...parsedState.solfeggio }
              : DEFAULT_BUILDER_STATE.solfeggio,
            binaural: parsedState.binaural
              ? { ...DEFAULT_BUILDER_STATE.binaural!, ...parsedState.binaural }
              : DEFAULT_BUILDER_STATE.binaural,
          });
        } catch (e) {
          console.error('Failed to parse saved state:', e);
        }
      }
    }

    // Only check authentication status on mount
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Save state to localStorage whenever it changes (after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem('guestBuilderState', JSON.stringify(state));
    }
  }, [state, isHydrated]);

  const calculateTotal = () => {
    let total = pricingInfo.isEligibleForDiscount ? pricingInfo.discountedPrice : pricingInfo.basePrice;
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

  const handleCheckout = async () => {
    if (authUnavailable) {
      alert('Authentication service is currently unavailable. Please check back soon.');
      return;
    }

    // If user is not authenticated, show auth modal first
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    await proceedWithCheckout();
  };

  const buildCheckoutBuilderState = () => {
    return {
      title: state.title || 'Custom Track',
      script: state.script,
      voice: {
        provider: state.voice.provider,
        voice_id: state.voice.voice_id,
        settings: {},
      },
      music: state.music && state.music.id !== 'none'
        ? {
            id: state.music.id,
            volume_db: -10,
          }
        : undefined,
      solfeggio: state.solfeggio?.enabled
        ? {
            enabled: true,
            frequency: state.solfeggio.frequency,
            volume_db: -16,
          }
        : undefined,
      binaural: state.binaural?.enabled
        ? {
            enabled: true,
            band: state.binaural.band,
            volume_db: -18,
          }
        : undefined,
      duration: state.duration,
      loop: state.loop,
    };
  };

  const proceedWithCheckout = async () => {
    setIsProcessing(true);

    try {
      if (!user) {
        throw new Error('User must be authenticated before checkout');
      }

      // Calculate total with add-ons
      const total = calculateTotal();

      // Prepare checkout data with user context
      const checkoutData = {
        userId: user.id, // IMPORTANT: Pass authenticated user ID
        builderState: buildCheckoutBuilderState(),
        successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href,
        priceAmount: Math.round(total * 100), // Use actual total, not hardcoded
        firstTrackDiscount: pricingInfo.isEligibleForDiscount, // Flag for webhook
      };

      // Create checkout session
      const response = await fetch('/api/checkout/guest-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthSuccess = async (authenticatedUser: any) => {
    console.log('handleAuthSuccess called with user:', authenticatedUser?.id || authenticatedUser?.email);

    try {
      let resolvedUser = authenticatedUser;
      if (!resolvedUser && supabaseClient) {
        const { data } = await supabaseClient.auth.getUser();
        resolvedUser = data.user;
      }
      if (!resolvedUser) {
        throw new Error('Unable to verify authenticated user');
      }

      // 1. Save authenticated user to state
      setUser(resolvedUser);
      setShowAuthModal(false);

      // Add a small delay to ensure session is propagated
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Fetching pricing eligibility...');
      // 2. NOW check pricing eligibility (user is authenticated)
      const response = await fetch('/api/pricing/check-eligibility');
      console.log('Pricing response status:', response.status);

      if (response.ok) {
        const pricingData = await response.json();
        console.log('Pricing data:', pricingData);

        // Update pricing display
        setPricingInfo({
          basePrice: pricingData.pricing.basePrice / 100,
          discountedPrice: pricingData.pricing.discountedPrice / 100,
          savings: pricingData.pricing.savings / 100,
          isEligibleForDiscount: pricingData.isEligibleForDiscount
        });

        // Alert user if they already used their discount (non-blocking)
        if (!pricingData.isEligibleForDiscount) {
          alert(
            "You've already used your first-track discount.\n\n" +
            "Regular pricing ($2.99) applies, but you can still create amazing tracks!"
          );
        }
      } else {
        console.warn('Pricing check failed, using default pricing');
      }

      console.log('Proceeding to checkout...');
      // 3. Proceed to checkout with CORRECT pricing (pass user directly to avoid stale state)
      await proceedWithCheckoutForUser(resolvedUser);
    } catch (error) {
      console.error('Error in auth success flow:', error);
      alert('Failed to start checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  const proceedWithCheckoutForUser = async (user: any) => {
    console.log('proceedWithCheckoutForUser called');
    setIsProcessing(true);

    try {
      if (!user) {
        throw new Error('User must be authenticated before checkout');
      }

      // Use either id or email as identifier
      const userId = user.id || user.email;
      console.log('User identifier:', userId);

      if (!userId) {
        throw new Error('User must have an ID or email');
      }

      // Calculate total with add-ons
      const total = calculateTotal();
      console.log('Total calculated:', total);

      // Prepare checkout data with user context
      const checkoutData = {
        userId: userId, // Can be either ID or email
        builderState: buildCheckoutBuilderState(),
        successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href,
        priceAmount: Math.round(total * 100),
        firstTrackDiscount: pricingInfo.isEligibleForDiscount,
      };

      console.log('Checkout data prepared:', { userId: checkoutData.userId, priceAmount: checkoutData.priceAmount, firstTrackDiscount: checkoutData.firstTrackDiscount });

      // Create checkout session
      console.log('Calling checkout API...');
      const response = await fetch('/api/checkout/guest-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData)
      });

      console.log('Checkout API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout API error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      console.log('Redirecting to Stripe:', url);

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
  };

  const scriptCharCount = state.script.length;
  const isScriptValid = scriptCharCount >= 10 && scriptCharCount <= 5000;
  const isTitleValid = state.title.trim().length >= 3;
  const authUnavailable = !!supabaseError || !supabaseClient;

  return (
    <div className={cn('bg-white rounded-2xl shadow-xl p-6 md:p-8', className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-sora mb-2">Create Your First Track</h2>
        <p className="text-gray-600">Build your personalized audio experience - no sign up required</p>
      </div>

      {supabaseError && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Authentication is temporarily unavailable. Please verify Supabase environment variables
          or try again later.
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 rounded-lg bg-gray-100 p-1 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('script')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'script'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Script
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('voice')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'voice'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Voice & Duration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('extras')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'extras'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Extras
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Script Tab */}
        {activeTab === 'script' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="track-title" className="block text-sm font-medium text-gray-700 mb-2">
                Track Title
              </label>
              <input
                id="track-title"
                type="text"
                value={state.title}
                onChange={(e) => setState({ ...state, title: e.target.value })}
                placeholder="e.g., Morning Focus Reset"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {state.title && !isTitleValid && (
                <p className="mt-1 text-sm text-red-500">
                  Title must be at least 3 characters long.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="script" className="block text-sm font-medium text-gray-700 mb-2">
                Your Script
              </label>
              <textarea
                id="script"
                value={state.script}
                onChange={(e) => setState({ ...state, script: e.target.value })}
                placeholder="Write your affirmation, meditation, or motivational script here..."
                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <div className="mt-2 flex justify-between text-sm">
                <span className={cn(
                  scriptCharCount < 10 || scriptCharCount > 5000 ? 'text-red-500' : 'text-gray-500'
                )}>
                  {scriptCharCount} / 5000 characters
                </span>
                {scriptCharCount >= 10 && (
                  <span className="text-gray-500">
                    Estimated duration: ~{Math.ceil(scriptCharCount / 150)} minutes
                  </span>
                )}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">Example Script:</h3>
              <p className="text-sm text-gray-700 italic">
                "I am confident and capable. Every day, I grow stronger and more resilient.
                I trust in my abilities and embrace new challenges with courage.
                Success flows to me naturally, and I am worthy of all good things."
              </p>
            </div>
          </div>
        )}

        {/* Voice Tab */}
        {activeTab === 'voice' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice Provider
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setState({
                    ...state,
                    voice: {
                      ...state.voice,
                      provider: 'openai',
                      voice_id: 'alloy',
                      name: 'Alloy (Neutral)'
                    }
                  })}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-colors',
                    state.voice.provider === 'openai'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="font-semibold">OpenAI</div>
                  <div className="text-sm text-gray-500">Natural AI voices</div>
                </button>
                <button
                  type="button"
                  onClick={() => setState({
                    ...state,
                    voice: {
                      ...state.voice,
                      provider: 'elevenlabs',
                      voice_id: 'rachel',
                      name: 'Rachel (Natural)'
                    }
                  })}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-colors',
                    state.voice.provider === 'elevenlabs'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="font-semibold">ElevenLabs</div>
                  <div className="text-sm text-gray-500">Premium voices</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Voice
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOICE_OPTIONS[state.voice.provider].map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setState({
                      ...state,
                      voice: { ...state.voice, voice_id: voice.id, name: voice.name }
                    })}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-colors',
                      state.voice.voice_id === voice.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="font-medium">{voice.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Track Duration
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => setState({ ...state, duration })}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium',
                      state.duration === duration
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {duration} min
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Loop Script</p>
                <button
                  type="button"
                  onClick={() => setState({
                    ...state,
                    loop: { ...state.loop, enabled: !state.loop.enabled }
                  })}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    state.loop.enabled ? 'bg-primary' : 'bg-gray-200'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    state.loop.enabled ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
              <div>
                <label htmlFor="loop-pause-guest" className="text-xs text-gray-500">
                  Pause between loops: {state.loop.pause_seconds}s
                </label>
                <input
                  id="loop-pause-guest"
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={state.loop.pause_seconds}
                  onChange={(e) => setState({
                    ...state,
                    loop: { ...state.loop, pause_seconds: Number(e.target.value) }
                  })}
                  className="mt-1 w-full"
                  disabled={!state.loop.enabled}
                />
              </div>
            </div>
          </div>
        )}

        {/* Extras Tab */}
        {activeTab === 'extras' && (
          <div className="space-y-6">
            {/* Background Music */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Music
                <span className="text-gray-500 font-normal ml-2">(+$0.99 each)</span>
              </label>
              <select
                value={state.music?.id || 'none'}
                onChange={(e) => {
                  const selected = BACKGROUND_MUSIC_OPTIONS.find(m => m.id === e.target.value);
                  setState({
                    ...state,
                    music: selected?.id === 'none' ? undefined : selected
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {BACKGROUND_MUSIC_OPTIONS.map((music) => (
                  <option key={music.id} value={music.id}>
                    {music.name} {music.price > 0 && `(+$${music.price})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Solfeggio Frequencies */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Solfeggio Frequencies
                  <span className="text-gray-500 font-normal ml-2">(+$0.99)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setState({
                    ...state,
                    solfeggio: { ...state.solfeggio!, enabled: !state.solfeggio?.enabled }
                  })}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    state.solfeggio?.enabled ? 'bg-primary' : 'bg-gray-200'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    state.solfeggio?.enabled ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
              {state.solfeggio?.enabled && (
                <select
                  value={state.solfeggio.frequency}
                  onChange={(e) => setState({
                    ...state,
                    solfeggio: { ...state.solfeggio!, frequency: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {SOLFEGGIO_FREQUENCIES.map((freq) => (
                    <option key={freq.value} value={freq.value}>
                      {freq.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Binaural Beats */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Binaural Beats
                  <span className="text-gray-500 font-normal ml-2">(+$0.99)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setState({
                    ...state,
                    binaural: { ...state.binaural!, enabled: !state.binaural?.enabled }
                  })}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    state.binaural?.enabled ? 'bg-primary' : 'bg-gray-200'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    state.binaural?.enabled ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
              {state.binaural?.enabled && (
                <select
                  value={state.binaural.band}
                  onChange={(e) => setState({
                    ...state,
                    binaural: {
                      ...state.binaural!,
                      band: e.target.value as typeof state.binaural.band
                    }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {BINAURAL_BANDS.map((band) => (
                    <option key={band.id} value={band.id}>
                      {band.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Pricing Note */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">First track special pricing!</span> Add-ons are discounted
                for your first track. Regular pricing applies to future tracks.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold">${calculateTotal().toFixed(2)}</div>
            <div className="text-sm text-gray-500">First track special price</div>
          </div>
      <Button
        size="lg"
        onClick={handleCheckout}
        disabled={!isScriptValid || !isTitleValid || isProcessing || authUnavailable}
        className="px-8"
      >
            {isProcessing ? 'Processing...' : 'Create Your First Track'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 text-center">
          {user ?
            `Signed in as ${user.email || 'authenticated user'}. ` :
            'Sign in required before checkout. '
          }
          {pricingInfo.isEligibleForDiscount && pricingInfo.savings > 0 ?
            `Save $${pricingInfo.savings.toFixed(2)} with first-track pricing!` :
            ''
          }
        </p>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthClose}
        onAuthenticated={handleAuthSuccess}
        mode="signup"
        title="Create Your First Track"
        description={`Sign up to create your personalized audio track ${pricingInfo.isEligibleForDiscount ? `with special first-time pricing - only $${pricingInfo.discountedPrice.toFixed(2)}!` : `for $${pricingInfo.basePrice.toFixed(2)}`}`}
      />
    </div>
  );
}

'use client';

import { Check, Sparkles, Music, Waves, Clock, Mic2 } from 'lucide-react';
import { Button } from '@mindscript/ui';
import { cn } from '../../../lib/utils';
import type { IntentionCategory } from './IntentionStep';
import type { VoiceProvider } from './VoiceStep';
import type { BinauralBand } from './EnhanceStep';

interface CreateStepProps {
  title: string;
  script: string;
  intention: IntentionCategory | null;
  voice: { provider: VoiceProvider; voice_id: string; name: string };
  duration: number;
  loopEnabled: boolean;
  solfeggio: { enabled: boolean; frequency: number; price: number } | undefined;
  binaural: { enabled: boolean; band: BinauralBand; price: number } | undefined;
  music: { id: string; name: string; price: number } | undefined;
  pricingInfo: {
    basePrice: number;
    discountedPrice: number;
    savings: number;
    isEligibleForDiscount: boolean;
    ffTier: string | null;
  };
  isProcessing: boolean;
  user: any;
  onCheckout: () => void;
  className?: string;
}

export function CreateStep({
  title,
  script,
  intention,
  voice,
  duration,
  loopEnabled,
  solfeggio,
  binaural,
  music,
  pricingInfo,
  isProcessing,
  user,
  onCheckout,
  className,
}: CreateStepProps) {
  const isFF = pricingInfo.ffTier === 'inner_circle' || pricingInfo.ffTier === 'cost_pass';

  const calculateTotal = () => {
    if (pricingInfo.ffTier === 'inner_circle') return 0;
    let total = pricingInfo.isEligibleForDiscount ? pricingInfo.discountedPrice : pricingInfo.basePrice;
    if (pricingInfo.ffTier === 'cost_pass') return total;
    if (music && music.id !== 'none') {
      total += music.price;
    }
    if (solfeggio?.enabled) {
      total += solfeggio.price;
    }
    if (binaural?.enabled) {
      total += binaural.price;
    }
    return total;
  };

  const total = calculateTotal();
  const wordCount = script.split(/\s+/).filter(Boolean).length;

  const summaryItems = [
    {
      icon: <Mic2 className="w-4 h-4" />,
      label: 'Voice',
      value: `${voice.name} (${voice.provider === 'openai' ? 'OpenAI' : 'ElevenLabs'})`,
    },
    {
      icon: <Clock className="w-4 h-4" />,
      label: 'Duration',
      value: `${duration} minutes${loopEnabled ? ' (looped)' : ''}`,
    },
  ];

  if (solfeggio?.enabled) {
    summaryItems.push({
      icon: <Waves className="w-4 h-4" />,
      label: 'Solfeggio',
      value: `${solfeggio.frequency} Hz`,
    });
  }

  if (binaural?.enabled) {
    summaryItems.push({
      icon: <Sparkles className="w-4 h-4" />,
      label: 'Binaural',
      value: binaural.band.charAt(0).toUpperCase() + binaural.band.slice(1),
    });
  }

  if (music) {
    summaryItems.push({
      icon: <Music className="w-4 h-4" />,
      label: 'Music',
      value: music.name,
    });
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold font-heading text-text">
          Ready to create
        </h2>
        <p className="text-muted">
          Review your selections and create your track
        </p>
      </div>

      {/* Summary Card */}
      <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-soft space-y-6">
        {/* Track Title */}
        <div>
          <h3 className="text-xl font-bold text-text">{title || 'Untitled Track'}</h3>
          {intention && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full capitalize">
              {intention}
            </span>
          )}
        </div>

        {/* Script Preview */}
        <div className="p-4 rounded-xl bg-soft-lavender/20 border border-soft-lavender/30">
          <p className="text-sm text-muted line-clamp-3 italic">"{script.slice(0, 200)}..."</p>
          <p className="text-xs text-muted/70 mt-2">{wordCount} words</p>
        </div>

        {/* Configuration Summary */}
        <div className="space-y-3">
          {summaryItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted">
                {item.icon}
                <span>{item.label}</span>
              </div>
              <span className="font-medium text-text">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Pricing Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Base track</span>
            <span className="text-text">
              {isFF ? (
                <>
                  <span className="line-through text-muted mr-2">
                    ${pricingInfo.basePrice.toFixed(2)}
                  </span>
                  <span className="text-accent font-medium">$0.00</span>
                </>
              ) : pricingInfo.isEligibleForDiscount ? (
                <>
                  <span className="line-through text-muted mr-2">
                    ${pricingInfo.basePrice.toFixed(2)}
                  </span>
                  <span className="text-accent font-medium">
                    ${pricingInfo.discountedPrice.toFixed(2)}
                  </span>
                </>
              ) : (
                `$${pricingInfo.basePrice.toFixed(2)}`
              )}
            </span>
          </div>

          {music && music.id !== 'none' && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Background music</span>
              <span className="text-text">
                {isFF ? (
                  <>
                    <span className="line-through text-muted mr-2">+${music.price.toFixed(2)}</span>
                    <span className="text-accent font-medium">$0.00</span>
                  </>
                ) : `+$${music.price.toFixed(2)}`}
              </span>
            </div>
          )}

          {solfeggio?.enabled && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Solfeggio frequency</span>
              <span className="text-text">
                {isFF ? (
                  <>
                    <span className="line-through text-muted mr-2">+${solfeggio.price.toFixed(2)}</span>
                    <span className="text-accent font-medium">$0.00</span>
                  </>
                ) : `+$${solfeggio.price.toFixed(2)}`}
              </span>
            </div>
          )}

          {binaural?.enabled && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Binaural beats</span>
              <span className="text-text">
                {isFF ? (
                  <>
                    <span className="line-through text-muted mr-2">+${binaural.price.toFixed(2)}</span>
                    <span className="text-accent font-medium">$0.00</span>
                  </>
                ) : `+$${binaural.price.toFixed(2)}`}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="font-semibold text-text">Total</span>
            <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
          </div>

          {isFF ? (
            <div className="flex items-center justify-center gap-2 text-sm text-accent">
              <Check className="w-4 h-4" />
              <span>Friends & Family — {pricingInfo.ffTier === 'inner_circle' ? 'everything is on us' : 'at-cost pricing'}!</span>
            </div>
          ) : pricingInfo.isEligibleForDiscount && pricingInfo.savings > 0 ? (
            <div className="flex items-center justify-center gap-2 text-sm text-accent">
              <Check className="w-4 h-4" />
              <span>You're saving ${pricingInfo.savings.toFixed(2)} with first-track pricing!</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Create Button */}
      <div className="space-y-3">
        <Button
          size="lg"
          onClick={onCheckout}
          disabled={isProcessing}
          className={cn(
            'w-full py-4 text-lg font-semibold',
            'bg-gradient-to-r from-primary to-primary-light hover:opacity-90',
            'transition-all duration-300',
            !isProcessing && 'glow-primary'
          )}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Create My Track
            </span>
          )}
        </Button>

        <p className="text-xs text-center text-muted">
          {user ? (
            `Signed in as ${user.email}. `
          ) : (
            'You\'ll sign in or create an account at checkout. '
          )}
          {isFF && total === 0 ? 'No payment required.' : 'Secure payment via Stripe.'}
        </p>
      </div>

      {/* Trust indicators */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted">
        <div className="flex items-center gap-1">
          <Check className="w-3 h-3 text-accent" />
          <span>Instant delivery</span>
        </div>
        <div className="flex items-center gap-1">
          <Check className="w-3 h-3 text-accent" />
          <span>Lifetime access</span>
        </div>
        <div className="flex items-center gap-1">
          <Check className="w-3 h-3 text-accent" />
          <span>High-quality audio</span>
        </div>
      </div>
    </div>
  );
}

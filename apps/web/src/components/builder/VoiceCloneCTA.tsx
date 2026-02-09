'use client';

import { Mic, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

type CTAVariant = 'sidebar' | 'hero' | 'inline';

interface VoiceCloneCTAProps {
  variant: CTAVariant;
  hasClonedVoice: boolean;
  onClick: () => void;
  isFF?: boolean;
  className?: string;
}

const BENEFITS = [
  'Record once, use on every track',
  'Just type your script — it speaks as you',
  'Works instantly after setup',
];

export function VoiceCloneCTA({ variant, hasClonedVoice, onClick, isFF, className }: VoiceCloneCTAProps) {
  if (hasClonedVoice) return null;

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full p-3 rounded-xl text-left transition-all duration-300',
          'bg-gradient-to-br from-primary/5 to-accent/5',
          'border border-primary/15 hover:border-primary/30',
          'hover:shadow-md hover:shadow-primary/5',
          'group',
          className,
        )}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Mic className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[13px] font-semibold text-text leading-tight">Your Voice, Your Tracks</span>
          </div>
          <p className="text-[11px] text-muted leading-snug">
            Clone your voice once with AI, then every script is read aloud in your own voice.
          </p>
          <ul className="space-y-0.5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-1 text-[10px] text-muted">
                <CheckCircle2 className="w-2.5 h-2.5 text-accent flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            {isFF ? (
              <span className="text-[11px] font-semibold text-accent">
                <span className="line-through text-muted mr-1">$29</span> FREE
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-primary">$29 one-time</span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-primary font-medium group-hover:gap-1.5 transition-all">
              Get started <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      </button>
    );
  }

  if (variant === 'hero') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full p-5 rounded-xl text-left transition-all duration-300',
          'bg-gradient-to-r from-primary/[0.07] via-primary/[0.04] to-accent/[0.07]',
          'border-2 border-primary/20 hover:border-primary/35',
          'hover:shadow-lg hover:shadow-primary/10',
          'group',
          className,
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center">
            <Mic className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-text">Hear Your Own Voice</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-semibold text-primary uppercase tracking-wide">
                  <Sparkles className="w-3 h-3" />
                  New
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Your affirmations and scripts deserve <span className="font-medium text-text">your voice</span>. Record a short sample once, and every track you create will be narrated by your AI-cloned voice — no re-recording needed.
              </p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-1.5 text-xs text-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 pt-0.5">
              {isFF ? (
                <span className="text-sm font-semibold text-accent">
                  <span className="line-through text-muted mr-1">$29</span> FREE
                </span>
              ) : (
                <span className="text-sm font-semibold text-primary">$29 one-time setup</span>
              )}
              <span className="flex items-center gap-1 text-sm text-primary font-medium group-hover:gap-2 transition-all">
                Clone your voice <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // inline variant — for library/marketplace pages
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full p-5 rounded-xl text-left transition-all duration-300',
        'bg-white/80 backdrop-blur-sm',
        'border border-primary/15 hover:border-primary/30',
        'hover:shadow-md hover:shadow-primary/5',
        'group',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
          <Mic className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <span className="text-sm font-bold text-text block">Make It Personal</span>
            <span className="text-xs text-muted leading-relaxed block mt-0.5">
              Clone your voice with AI — record once, then just type your text and hear it spoken as you. Setup once, use on every track.
            </span>
          </div>
          <div className="flex items-center justify-between">
            {isFF ? (
              <span className="text-xs font-semibold text-accent">
                <span className="line-through text-muted mr-1">$29</span> FREE
              </span>
            ) : (
              <span className="text-xs font-semibold text-primary">$29 one-time</span>
            )}
            <span className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

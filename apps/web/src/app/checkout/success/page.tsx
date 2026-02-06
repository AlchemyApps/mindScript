"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Headphones, Sparkles, Music2, ArrowRight } from "lucide-react";
import { FloatingOrbs } from "../../../components/landing/FloatingOrbs";
import { GlassCard } from "../../../components/ui/GlassCard";
import { GradientButton } from "../../../components/ui/GradientButton";
import { cn } from "../../../lib/utils";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || searchParams.get("cs");
  const checkoutType = searchParams.get("type"); // 'edit' for track edits
  const [loading, setLoading] = useState(true);
  const [pollStatus, setPollStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Trigger track creation immediately
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    setPollStatus('processing');

    fetch('/api/webhooks/stripe/local-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          console.error('[SUCCESS-PAGE] Processing failed:', data);
          setPollStatus('error');
          setError(data.error || 'Failed to process purchase');
          return;
        }
        console.log('[SUCCESS-PAGE] Processing initiated:', data);

        // For track edits, redirect straight to library
        if (data.type === 'track_edit' || checkoutType === 'edit') {
          setPollStatus('success');
          setTimeout(() => {
            window.location.href = '/library?edited=true';
          }, 1500);
          return;
        }

        // For new tracks, poll for completion
        setPollStatus('processing');
        pollForTrackCompletion();
      })
      .catch(err => {
        console.error('[SUCCESS-PAGE] Error calling local trigger:', err);
        setPollStatus('error');
        setError(err.message || 'Network error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const pollForTrackCompletion = () => {
    if (!sessionId) return;

    let pollCount = 0;
    const maxPolls = 60;

    const poll = async () => {
      try {
        const response = await fetch('/api/library/tracks?status=all&ownership=owned&includeRenderStatus=true');
        if (!response.ok) {
          throw new Error('Failed to fetch tracks');
        }
        const data = await response.json();
        const track = (data.tracks || []).find((t: any) => t.renderStatus && t.renderStatus.id);

        if (track && (track.audio_url || track.status === 'published')) {
          setPollStatus('success');
          setTimeout(() => {
            window.location.href = `/library?new=true&session=${sessionId}`;
          }, 2500);
          return;
        }

        pollCount += 1;
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000);
        } else {
          setPollStatus('error');
          setError('Track is taking longer than expected. Check your library in a few minutes.');
        }
      } catch (err) {
        console.error('[SUCCESS-PAGE] Polling error:', err);
        pollCount += 1;
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000);
        } else {
          setPollStatus('error');
          setError('Track is taking longer than expected. Visit your library in a few minutes.');
        }
      }
    };

    poll();
  };

  // Loading/Processing Payment State
  if (loading) {
    return (
      <div className="min-h-screen bg-warm-gradient relative overflow-hidden flex items-center justify-center p-4">
        <FloatingOrbs variant="subtle" />

        <GlassCard hover="none" className="max-w-md w-full p-8 text-center relative z-10">
          {/* Breathing loader */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 animate-breathe flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light animate-spin-slow flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              {/* Ripple effect */}
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            </div>
          </div>

          <h2 className="text-2xl font-heading font-semibold text-text mb-3">
            Preparing your meditation experience...
          </h2>
          <p className="text-muted">
            Please wait while we confirm your purchase
          </p>
        </GlassCard>
      </div>
    );
  }

  // Track Ready State
  if (pollStatus === 'success') {
    return (
      <div className="min-h-screen bg-hero-gradient relative overflow-hidden flex items-center justify-center p-4">
        <FloatingOrbs variant="vibrant" />

        <div className="relative z-10 max-w-md w-full">
          <GlassCard hover="glow" glowColor="accent" className="p-8 text-center">
            {/* Celebration icon with glow */}
            <div className="mb-8 flex justify-center">
              <div className="relative animate-scale-in">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                  <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
                </div>
                {/* Sparkle accents */}
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-soft animate-float" />
                <Sparkles className="absolute -bottom-1 -left-3 w-5 h-5 text-primary-light animate-float-delayed" />
              </div>
            </div>

            <h1 className="text-3xl font-heading font-bold mb-3">
              <span className="text-gradient">Your Track is Ready!</span>
            </h1>

            <p className="text-muted mb-8">
              Taking you to your personal library...
            </p>

            {/* Animated progress dots */}
            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-accent animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>

            <Link href="/library" className="block">
              <GradientButton variant="accent" fullWidth glow>
                <Headphones className="w-5 h-5 mr-2" />
                Listen Now
              </GradientButton>
            </Link>
          </GlassCard>
        </div>
      </div>
    );
  }

  // Track Rendering State (Processing or Error)
  return (
    <div className="min-h-screen bg-warm-gradient relative overflow-hidden flex items-center justify-center p-4">
      <FloatingOrbs variant="subtle" />

      <div className="relative z-10 max-w-lg w-full space-y-6">
        {/* Main success card */}
        <GlassCard hover="none" className="p-8 text-center">
          {/* Success checkmark */}
          <div className="mb-6 flex justify-center">
            <div className="relative animate-scale-in">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-calm-mint flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-accent" strokeWidth={2} />
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-heading font-bold mb-2">
            <span className="text-gradient">Payment Successful!</span>
          </h1>

          <p className="text-lg text-muted mb-6">
            Your journey begins now
          </p>

          {/* Render progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 text-sm text-muted mb-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                pollStatus === 'processing' ? "bg-primary animate-pulse" : "bg-accent"
              )} />
              <span>
                {pollStatus === 'processing'
                  ? "Crafting your personalized track..."
                  : pollStatus === 'error'
                    ? "We're working on it..."
                    : "Preparing..."}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  pollStatus === 'error'
                    ? "bg-warm-gold w-3/4"
                    : "bg-gradient-to-r from-primary to-accent w-2/3 animate-pulse"
                )}
              />
            </div>
          </div>

          {/* Error notice */}
          {pollStatus === 'error' && (
            <div className="mb-6 p-4 rounded-xl bg-soft/30 border border-warm-gold/30 text-left animate-slide-up">
              <p className="text-sm text-warm-gold font-medium mb-1">
                Taking a bit longer than usual
              </p>
              <p className="text-xs text-muted">
                {error || "Your track is still being created. We'll have it ready soon."}
              </p>
            </div>
          )}
        </GlassCard>

        {/* What's happening card */}
        <GlassCard hover="lift" className="p-6">
          <h3 className="font-heading font-semibold text-text mb-4 flex items-center gap-2">
            <Music2 className="w-5 h-5 text-primary" />
            What's happening?
          </h3>

          <div className="space-y-3">
            {[
              { text: "Recording your voice narration with our AI voices", delay: "0ms" },
              { text: "Mixing background music and healing tones", delay: "100ms" },
              { text: "Mastering the final track for optimal quality", delay: "200ms" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 animate-slide-up-fade"
                style={{ animationDelay: item.delay }}
              >
                <div className="w-5 h-5 rounded-full bg-soft-lavender flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-sm text-muted">{item.text}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted mt-4 pt-4 border-t border-gray-100">
            This usually takes 2-5 minutes. We'll email you when it's ready.
          </p>
        </GlassCard>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/library" className="flex-1">
            <GradientButton variant="primary" fullWidth glow>
              <Headphones className="w-4 h-4 mr-2" />
              Go to Library
            </GradientButton>
          </Link>

          <Link href="/builder" className="flex-1">
            <button className="w-full px-6 py-3 rounded-xl glass text-text font-medium hover-lift flex items-center justify-center gap-2 transition-all">
              Create Another
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>

        {/* Order reference */}
        {sessionId && (
          <p className="text-center text-xs text-muted/60">
            Order: {sessionId.slice(0, 24)}...
          </p>
        )}
      </div>
    </div>
  );
}

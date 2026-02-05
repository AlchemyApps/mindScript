'use client';

import { ChevronDown, Sparkles, AudioLines, Headphones } from 'lucide-react';
import { FloatingOrbs } from './FloatingOrbs';
import { cn } from '../../lib/utils';

interface HeroSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function HeroSection({ className, children }: HeroSectionProps) {
  const scrollToBuilder = () => {
    const builderSection = document.getElementById('builder');
    if (builderSection) {
      builderSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className={cn('relative min-h-screen flex flex-col', className)}>
      {/* Atmospheric Background */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <FloatingOrbs variant="hero" />

      {/* Noise texture overlay for depth */}
      <div className="absolute inset-0 noise-overlay" />

      {/* Main Content */}
      <div className="relative flex-1 flex items-center pt-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Messaging */}
            <div className="text-center lg:text-left space-y-6 animate-slide-up-fade">
              {/* Badge */}
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/30 shadow-sm">
                <Sparkles className="w-4 h-4 text-primary mr-2" />
                <span className="text-sm font-medium text-text">Transform your mindset</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading leading-tight">
                <span className="text-text">Program your</span>
                <br />
                <span className="text-gradient">inner voice</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Create personalized affirmation audio with AI voices, soothing music, and
                healing frequencies. Your daily practice for a calmer, more focused mind.
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <FeaturePill icon={<AudioLines className="w-4 h-4" />} label="AI Voices" />
                <FeaturePill icon={<Headphones className="w-4 h-4" />} label="Binaural Beats" />
                <FeaturePill icon={<Sparkles className="w-4 h-4" />} label="Solfeggio Tones" />
              </div>

              {/* Trust Indicators */}
              <div className="pt-4">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-primary">1,000+</span> audio tracks created
                </p>
              </div>
            </div>

            {/* Right Column - Builder Preview / CTA */}
            <div className="relative animate-slide-up-fade" style={{ animationDelay: '0.2s' }}>
              {/* Glow effect behind card */}
              <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full animate-breathe" />

              {/* Builder Card Container */}
              <div className="relative">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="relative pb-8 flex justify-center">
        <button
          onClick={scrollToBuilder}
          className="flex flex-col items-center text-muted hover:text-primary transition-colors group"
          aria-label="Scroll to builder"
        >
          <span className="text-sm font-medium mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
            Start creating
          </span>
          <div className="animate-breathe">
            <ChevronDown className="w-6 h-6" />
          </div>
        </button>
      </div>
    </section>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/50 backdrop-blur-sm border border-white/30 text-sm text-text/80">
      <span className="text-primary mr-1.5">{icon}</span>
      {label}
    </div>
  );
}

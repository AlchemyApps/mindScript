'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { StepBuilder } from '@/components/builder/StepBuilder';

interface FeaturePillDef {
  icon: ReactNode;
  label: string;
}

interface LandingHeroWithBuilderProps {
  badge: { icon: ReactNode; text: string };
  headline: ReactNode;
  description: string;
  pricingLabel: string;
  featurePills?: FeaturePillDef[];
}

export function LandingHeroWithBuilder({
  badge,
  headline,
  description,
  pricingLabel,
  featurePills,
}: LandingHeroWithBuilderProps) {
  const [firstTrackPrice, setFirstTrackPrice] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pricing/check-eligibility')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.pricing) {
          setFirstTrackPrice(`$${(data.pricing.discountedPrice / 100).toFixed(2)}`);
        }
      })
      .catch(() => {});
  }, []);

  const scrollToBuilder = () => {
    const builderSection = document.getElementById('builder');
    if (builderSection) {
      builderSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="pt-12 pb-16 px-4">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column - Messaging */}
          <div className="text-center lg:text-left space-y-6 animate-slide-up-fade lg:sticky lg:top-32">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/30 shadow-sm">
              <span className="w-4 h-4 text-primary mr-2">{badge.icon}</span>
              <span className="text-sm font-medium text-text">{badge.text}</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading leading-tight">
              {headline}
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {description}
            </p>

            {/* Feature Pills */}
            {featurePills && featurePills.length > 0 && (
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                {featurePills.map((pill) => (
                  <div
                    key={pill.label}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/50 backdrop-blur-sm border border-white/30 text-sm text-text/80"
                  >
                    <span className="text-primary mr-1.5">{pill.icon}</span>
                    {pill.label}
                  </div>
                ))}
              </div>
            )}

            {/* Pricing CTA */}
            {firstTrackPrice && (
              <div className="pt-2">
                <p className="text-lg text-muted">
                  {pricingLabel}{' '}
                  <span className="text-3xl font-bold text-primary">{firstTrackPrice}</span>
                </p>
                <button
                  onClick={scrollToBuilder}
                  className="mt-3 lg:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Start building below
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Builder */}
          <div id="builder" className="relative animate-slide-up-fade" style={{ animationDelay: '0.2s' }}>
            {/* Glow effect behind card */}
            <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full animate-breathe" />

            <div className="relative">
              <StepBuilder variant="card" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

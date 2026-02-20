'use client';

import { GradientButton } from '@/components/ui/GradientButton';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';

interface LandingCTAProps {
  heading?: string;
  description?: string;
}

export function LandingCTA({
  heading = 'Ready to Transform Your Mindset?',
  description = 'Create personalized affirmation audio with studio-quality voices, healing frequencies, and ambient soundscapes.',
}: LandingCTAProps) {
  return (
    <section className="py-20 px-4 relative overflow-hidden bg-hero-gradient">
      <FloatingOrbs variant="vibrant" />
      <div className="container mx-auto relative z-10 text-center max-w-2xl">
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4">
          <span className="text-gradient">{heading}</span>
        </h2>
        <p className="text-lg text-muted mb-8 max-w-xl mx-auto">
          {description}
        </p>
        <GradientButton
          size="lg"
          glow
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          Start Building Your Track
        </GradientButton>
      </div>
    </section>
  );
}

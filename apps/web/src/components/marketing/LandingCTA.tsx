'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GradientButton } from '@/components/ui/GradientButton';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

interface LandingCTAProps {
  heading?: string;
  description?: string;
  landingPage?: string;
}

export function LandingCTA({
  heading = 'Ready to Transform Your Mindset?',
  description = 'Create personalized affirmation audio with studio-quality voices, healing frequencies, and ambient soundscapes.',
  landingPage,
}: LandingCTAProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsLoggedIn(!!user);
      } catch {
        // Not logged in
      }
    };
    checkAuth();
  }, []);

  const href = isLoggedIn ? '/builder' : (landingPage || '/');
  const label = isLoggedIn ? 'Start Building Your Track' : 'Create Your First Track';

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
        <Link href={href}>
          <GradientButton size="lg" glow>
            {label}
          </GradientButton>
        </Link>
      </div>
    </section>
  );
}

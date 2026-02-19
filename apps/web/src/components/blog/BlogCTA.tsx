'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

interface BlogCTAProps {
  relatedLandingPage?: string;
}

export function BlogCTA({ relatedLandingPage }: BlogCTAProps) {
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

  const href = isLoggedIn ? '/builder' : (relatedLandingPage || '/');
  const label = isLoggedIn ? 'Start Building Your Track' : 'Create Your First Track';

  return (
    <div className="max-w-3xl mx-auto my-12">
      <GlassCard
        hover="glow"
        glowColor="primary"
        className="text-center bg-gradient-to-br from-primary/5 via-transparent to-accent/5"
      >
        <h3 className="font-heading font-bold text-text text-xl md:text-2xl mb-3">
          Ready to Transform Your Mindset?
        </h3>
        <p className="text-muted mb-6 max-w-md mx-auto">
          Create personalized affirmation audio with studio-quality voices, healing frequencies, and ambient soundscapes.
        </p>
        <Link href={href}>
          <GradientButton size="lg" glow>
            {label}
          </GradientButton>
        </Link>
      </GlassCard>
    </div>
  );
}

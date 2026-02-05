'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@mindscript/auth/hooks';
import { StepBuilder } from '@/components/builder/StepBuilder';
import { GlassCard } from '@/components/ui/GlassCard';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { Spinner } from '@mindscript/ui';

export default function BuilderPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user && !hasRedirected) {
      setHasRedirected(true);
      const redirectTimer = setTimeout(() => {
        router.push('/auth/login?redirect=/builder');
      }, 100);
      return () => clearTimeout(redirectTimer);
    }
  }, [user, loading, hasRedirected, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-gradient relative flex items-center justify-center">
        <FloatingOrbs variant="subtle" />
        <GlassCard className="text-center relative z-10">
          <Spinner className="h-12 w-12 mx-auto mb-4 text-primary" />
          <p className="text-muted">Loading builder...</p>
        </GlassCard>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <StepBuilder variant="full" />;
}

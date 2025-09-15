'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, analytics } from '@/lib/posthog';
import { useAuth } from '@mindscript/auth';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Initialize PostHog
  useEffect(() => {
    initPostHog();
  }, []);

  // Track page views
  useEffect(() => {
    if (pathname) {
      const url = pathname + (searchParams ? `?${searchParams.toString()}` : '');
      analytics.pageView(url);
    }
  }, [pathname, searchParams]);

  // Identify user
  useEffect(() => {
    if (user) {
      analytics.identify(user.id, {
        email: user.email,
        created_at: user.created_at,
        subscription_tier: user.user_metadata?.subscription_tier,
      });
    } else {
      analytics.reset();
    }
  }, [user]);

  return <>{children}</>;
}
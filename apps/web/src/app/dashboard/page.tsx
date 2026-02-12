'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@mindscript/auth/hooks';
import { Sparkles, Library, Mic2, Settings, LogOut } from 'lucide-react';
import { Header } from '@/components/navigation/Header';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { usePlayerStore } from '@/store/playerStore';
import { cn } from '@/lib/utils';

interface FFInfo {
  ffTier: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [ffInfo, setFFInfo] = useState<FFInfo>({ ffTier: null });
  const { currentTrack } = usePlayerStore();

  useEffect(() => {
    if (!loading && !user && !hasRedirected) {
      setHasRedirected(true);
      const redirectTimer = setTimeout(() => {
        router.push('/auth/login');
      }, 100);
      return () => clearTimeout(redirectTimer);
    }
  }, [user, loading, hasRedirected, router]);

  // Fetch F&F tier info
  useEffect(() => {
    if (!user) return;
    fetch('/api/pricing/check-eligibility')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.ffTier) {
          setFFInfo({ ffTier: data.ffTier });
        }
      })
      .catch(() => {});
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className={cn('min-h-screen bg-warm-gradient relative', currentTrack && 'pb-24')}>
        <Header variant="solid" />
        <FloatingOrbs variant="subtle" />
        <div className="relative z-10 pt-16 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = profile?.profile?.displayName || user?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const ffTierLabel = ffInfo.ffTier === 'inner_circle' ? 'Inner Circle' : ffInfo.ffTier === 'cost_pass' ? 'Cost Pass' : null;

  const actionCards = [
    {
      title: 'Create Track',
      description: 'Build a new personalized audio track',
      icon: <Sparkles className="w-6 h-6" />,
      gradient: 'from-primary to-primary-light',
      glowColor: 'primary' as const,
      onClick: () => router.push('/builder'),
      cta: 'Start Building',
      primary: true,
    },
    {
      title: 'Your Library',
      description: 'Listen to your created tracks',
      icon: <Library className="w-6 h-6" />,
      gradient: 'from-accent to-emerald-400',
      glowColor: 'accent' as const,
      onClick: () => router.push('/library'),
      cta: 'Open Library',
    },
    {
      title: 'Custom Voice',
      description: ffTierLabel ? 'Clone your voice for free' : 'Clone your voice',
      icon: <Mic2 className="w-6 h-6" />,
      gradient: 'from-purple-500 to-pink-500',
      glowColor: 'meditation' as const,
      onClick: () => router.push('/builder?voice_clone=start'),
      cta: 'Create Voice',
    },
    {
      title: 'Account Settings',
      description: 'Manage your profile and preferences',
      icon: <Settings className="w-6 h-6" />,
      gradient: 'from-slate-500 to-slate-400',
      glowColor: 'primary' as const,
      onClick: () => router.push('/settings'),
      cta: 'Manage Account',
    },
  ];

  return (
    <div className={cn('min-h-screen bg-warm-gradient relative', currentTrack && 'pb-24')}>
      <Header variant="solid" />
      <FloatingOrbs variant="subtle" />

      <div className="relative z-10 pt-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <GlassCard hover="none" className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xl font-bold shadow-lg">
                {initial}
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading text-text">
                  Welcome back, {displayName}
                </h1>
                <p className="text-sm text-muted mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* F&F Badge */}
              {ffTierLabel && (
                <span className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold',
                  ffInfo.ffTier === 'inner_circle'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700'
                )}>
                  {ffTierLabel}
                </span>
              )}

              <button
                onClick={handleSignOut}
                className="p-2.5 rounded-xl glass hover:bg-gray-100/80 text-muted hover:text-text transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {actionCards.map((card) => (
            <GlassCard
              key={card.title}
              hover="both"
              glowColor={card.glowColor}
              className={cn(
                'cursor-pointer group',
                card.primary && 'md:col-span-2'
              )}
              onClick={card.onClick}
            >
              <div className={cn(
                'flex items-start gap-4',
                card.primary && 'md:flex-row md:items-center'
              )}>
                {/* Icon */}
                <div className={cn(
                  'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md flex-shrink-0',
                  card.gradient
                )}>
                  {card.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold font-heading text-text group-hover:text-primary transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-sm text-muted mt-0.5">
                    {card.description}
                  </p>
                </div>

                {/* CTA */}
                {card.primary ? (
                  <GradientButton
                    glow
                    breathing
                    size="md"
                    onClick={(e) => {
                      e.stopPropagation();
                      card.onClick();
                    }}
                    className="flex-shrink-0"
                  >
                    {card.cta}
                  </GradientButton>
                ) : (
                  <span className="text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center">
                    {card.cta} &rarr;
                  </span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}

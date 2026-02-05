'use client';

import { Header } from '@/components/navigation/Header';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { usePlayerStore } from '@/store/playerStore';
import { cn } from '@/lib/utils';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentTrack } = usePlayerStore();

  return (
    <div className={cn('min-h-screen bg-warm-gradient relative', currentTrack && 'pb-24')}>
      <Header variant="solid" />
      <FloatingOrbs variant="subtle" />
      <div className="relative z-10 pt-16">
        {children}
      </div>
    </div>
  );
}

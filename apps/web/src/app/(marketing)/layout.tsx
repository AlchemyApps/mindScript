'use client';

import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/navigation/Footer';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { usePlayerStore } from '@/store/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentTrack, playerMode } = usePlayerStore(
    useShallow((state) => ({
      currentTrack: state.currentTrack,
      playerMode: state.playerMode,
    }))
  );

  const needsBottomPadding = currentTrack && playerMode === 'bar';

  return (
    <div className={cn('min-h-screen bg-warm-gradient relative', needsBottomPadding && 'pb-24')}>
      <Header variant="solid" />
      <FloatingOrbs variant="subtle" />
      <div className="relative z-10 pt-16">
        {children}
      </div>
      <Footer className="relative z-10" />
    </div>
  );
}

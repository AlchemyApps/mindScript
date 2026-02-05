'use client';

import { useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { GlassPlayer } from '@/components/player/GlassPlayer';

export function MiniPlayer() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { currentTrack } = usePlayerStore();

  if (!currentTrack) {
    return null;
  }

  if (isExpanded) {
    return (
      <GlassPlayer
        mode="full"
        onMinimize={() => setIsExpanded(false)}
        onClose={() => setIsExpanded(false)}
      />
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <GlassPlayer
        mode="mini"
        onExpand={() => setIsExpanded(true)}
      />
    </div>
  );
}

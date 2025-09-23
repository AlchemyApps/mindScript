'use client';

import { useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { AudioPlayer } from '@/app/(authenticated)/library/components/AudioPlayer';

export function MiniPlayer() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { currentTrack } = usePlayerStore();

  // Only show the mini player if there's a track loaded
  if (!currentTrack) {
    return null;
  }

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-background max-w-2xl w-full rounded-lg">
          <div className="p-4">
            <button
              onClick={() => setIsExpanded(false)}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Minimize
            </button>
            <AudioPlayer mode="full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg">
      <AudioPlayer mode="mini" onExpand={() => setIsExpanded(true)} />
    </div>
  );
}
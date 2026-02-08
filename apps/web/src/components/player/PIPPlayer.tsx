'use client';

import { PlayIcon, PauseIcon, Maximize2Icon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PIPPlayerProps {
  isPlaying: boolean;
  onRestore: () => void;
  onTogglePlayPause: () => void;
}

export function PIPPlayer({ isPlaying, onRestore, onTogglePlayPause }: PIPPlayerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-pip-enter">
      {/* Pulsing energy ring — only visible when playing */}
      {isPlaying && (
        <div
          className="absolute inset-0 rounded-full animate-glow-pulse"
          style={{
            boxShadow: '0 0 20px rgba(108, 99, 255, 0.4), 0 0 40px rgba(108, 99, 255, 0.15)',
          }}
        />
      )}

      {/* Outer ring — subtle rotating gradient border when playing */}
      {isPlaying && (
        <div className="absolute -inset-1 rounded-full animate-spin-slow opacity-60">
          <div className="w-full h-full rounded-full bg-gradient-conic from-primary via-transparent to-accent"
               style={{
                 background: 'conic-gradient(from 0deg, #6C63FF, transparent 40%, #10B981, transparent 70%, #6C63FF)',
                 mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 2px))',
                 WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 2px))',
               }}
          />
        </div>
      )}

      {/* Main orb */}
      <button
        type="button"
        onClick={onRestore}
        aria-label="Restore player"
        className={cn(
          'relative w-16 h-16 rounded-full',
          'bg-black/60 backdrop-blur-md',
          'border border-white/10',
          'flex items-center justify-center',
          'transition-all duration-300 ease-therapeutic',
          'hover:scale-110 hover:border-white/25',
          'hover:shadow-[0_0_24px_rgba(108,99,255,0.3)]',
          'active:scale-95',
          'cursor-pointer',
        )}
      >
        {/* Inner soft glow */}
        <div className="absolute inset-2 rounded-full bg-white/[0.03]" />

        {/* Play/Pause icon */}
        <div
          className="relative z-10 text-white/90 transition-transform duration-200"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlayPause();
          }}
        >
          {isPlaying ? (
            <PauseIcon className="h-6 w-6" />
          ) : (
            <PlayIcon className="h-6 w-6 ml-0.5" />
          )}
        </div>
      </button>

      {/* Expand hint */}
      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
        <Maximize2Icon className="w-2.5 h-2.5 text-white/60" />
      </div>
    </div>
  );
}

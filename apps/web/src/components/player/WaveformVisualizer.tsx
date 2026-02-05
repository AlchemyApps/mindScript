'use client';

import { useMemo } from 'react';
import { cn } from '../../lib/utils';

interface WaveformVisualizerProps {
  isPlaying: boolean;
  progress?: number; // 0-100
  barCount?: number;
  className?: string;
}

export function WaveformVisualizer({
  isPlaying,
  progress = 0,
  barCount = 40,
  className,
}: WaveformVisualizerProps) {
  // Generate static waveform pattern (mimics audio waveform shape)
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      // Create a natural waveform-like pattern
      const normalizedPosition = i / barCount;
      const baseHeight = Math.sin(normalizedPosition * Math.PI) * 0.6 + 0.4;
      const variation = Math.sin(normalizedPosition * Math.PI * 8) * 0.2;
      const randomVariation = Math.sin(i * 1.5) * 0.15;

      return Math.max(0.15, Math.min(1, baseHeight + variation + randomVariation));
    });
  }, [barCount]);

  const progressIndex = Math.floor((progress / 100) * barCount);

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-[2px] h-12',
        className
      )}
      aria-hidden="true"
    >
      {bars.map((height, i) => {
        const isPast = i < progressIndex;
        const isCurrent = i === progressIndex;

        return (
          <div
            key={i}
            className={cn(
              'w-1 rounded-full transition-all duration-300',
              isPast && 'bg-gradient-to-t from-primary to-accent',
              isCurrent && 'bg-gradient-to-t from-primary via-primary-light to-accent',
              !isPast && !isCurrent && 'bg-white/20',
              isPlaying && isCurrent && 'animate-pulse'
            )}
            style={{
              height: `${height * 100}%`,
              transform: isPlaying && Math.abs(i - progressIndex) < 3
                ? `scaleY(${1 + Math.random() * 0.3})`
                : undefined,
              transition: isPlaying ? 'transform 0.1s ease-out, height 0.3s ease-out' : 'height 0.3s ease-out',
            }}
          />
        );
      })}
    </div>
  );
}

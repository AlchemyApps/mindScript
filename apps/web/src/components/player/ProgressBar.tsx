'use client';

import { forwardRef, useCallback, useRef, type MouseEvent, type TouchEvent } from 'react';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  showGlow?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: { track: 'h-1', thumb: 'w-3 h-3' },
  md: { track: 'h-2', thumb: 'w-4 h-4' },
  lg: { track: 'h-3', thumb: 'w-5 h-5' },
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
};

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ currentTime, duration, onSeek, showGlow = true, size = 'md', className }, ref) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const sizeConfig = SIZE_CLASSES[size];

    const calculateSeekPosition = useCallback(
      (clientX: number) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const position = (clientX - rect.left) / rect.width;
        const newTime = Math.max(0, Math.min(duration, position * duration));
        onSeek(newTime);
      },
      [duration, onSeek]
    );

    const handleClick = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        calculateSeekPosition(e.clientX);
      },
      [calculateSeekPosition]
    );

    const handleMouseMove = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (e.buttons !== 1) return;
        calculateSeekPosition(e.clientX);
      },
      [calculateSeekPosition]
    );

    const handleTouchMove = useCallback(
      (e: TouchEvent<HTMLDivElement>) => {
        if (e.touches.length !== 1) return;
        calculateSeekPosition(e.touches[0].clientX);
      },
      [calculateSeekPosition]
    );

    return (
      <div ref={ref} className={cn('flex items-center gap-3 w-full', className)}>
        {/* Current time */}
        <span className="text-xs text-white/60 min-w-[40px] text-right font-mono">
          {formatTime(currentTime)}
        </span>

        {/* Track */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
          className={cn(
            'relative flex-1 rounded-full bg-white/20 cursor-pointer group',
            sizeConfig.track
          )}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
        >
          {/* Filled portion */}
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              'bg-gradient-to-r from-primary via-primary-light to-accent',
              'transition-all duration-75 ease-out',
              showGlow && 'shadow-[0_0_10px_rgba(108,99,255,0.5),0_0_20px_rgba(16,185,129,0.3)]'
            )}
            style={{ width: `${progress}%` }}
          />

          {/* Thumb */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 rounded-full',
              'bg-white border-2 border-primary',
              'shadow-lg',
              'transition-transform duration-150',
              'opacity-0 group-hover:opacity-100',
              'hover:scale-110',
              sizeConfig.thumb,
              showGlow && 'shadow-[0_0_10px_rgba(108,99,255,0.5)]'
            )}
            style={{
              left: `calc(${progress}% - ${parseInt(sizeConfig.thumb.split(' ')[0].replace('w-', '')) * 2}px)`,
            }}
          />
        </div>

        {/* Duration */}
        <span className="text-xs text-white/60 min-w-[40px] font-mono">
          {formatTime(duration)}
        </span>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';

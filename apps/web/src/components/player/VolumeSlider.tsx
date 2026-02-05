'use client';

import { forwardRef, useCallback, useRef, type MouseEvent } from 'react';
import { Volume2Icon, VolumeXIcon, Volume1Icon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VolumeSliderProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  orientation?: 'horizontal' | 'vertical';
  showGlow?: boolean;
  className?: string;
}

export const VolumeSlider = forwardRef<HTMLDivElement, VolumeSliderProps>(
  ({
    volume,
    isMuted,
    onVolumeChange,
    onToggleMute,
    orientation = 'horizontal',
    showGlow = true,
    className,
  }, ref) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const displayVolume = isMuted ? 0 : volume;

    const getVolumeIcon = () => {
      if (isMuted || volume === 0) return VolumeXIcon;
      if (volume < 0.5) return Volume1Icon;
      return Volume2Icon;
    };

    const VolumeIcon = getVolumeIcon();

    const handleTrackClick = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();

        let newVolume: number;
        if (orientation === 'vertical') {
          newVolume = 1 - (e.clientY - rect.top) / rect.height;
        } else {
          newVolume = (e.clientX - rect.left) / rect.width;
        }

        onVolumeChange(Math.max(0, Math.min(1, newVolume)));
      },
      [orientation, onVolumeChange]
    );

    const handleDrag = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (e.buttons !== 1 || !trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();

        let newVolume: number;
        if (orientation === 'vertical') {
          newVolume = 1 - (e.clientY - rect.top) / rect.height;
        } else {
          newVolume = (e.clientX - rect.left) / rect.width;
        }

        onVolumeChange(Math.max(0, Math.min(1, newVolume)));
      },
      [orientation, onVolumeChange]
    );

    const isVertical = orientation === 'vertical';

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2',
          isVertical && 'flex-col-reverse h-32',
          className
        )}
      >
        {/* Mute button */}
        <button
          type="button"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          onClick={onToggleMute}
          className={cn(
            'p-2 rounded-full transition-colors',
            'hover:bg-white/10 text-white/80 hover:text-white'
          )}
        >
          <VolumeIcon className="h-4 w-4" />
        </button>

        {/* Track */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayVolume * 100)}
          tabIndex={0}
          className={cn(
            'relative rounded-full bg-white/20 cursor-pointer group',
            isVertical ? 'w-2 h-full' : 'w-24 h-2'
          )}
          onClick={handleTrackClick}
          onMouseMove={handleDrag}
        >
          {/* Filled portion */}
          <div
            className={cn(
              'absolute rounded-full',
              'bg-gradient-to-r from-accent to-accent-light',
              'transition-all duration-75 ease-out',
              showGlow && 'shadow-[0_0_8px_rgba(16,185,129,0.5)]',
              isVertical ? 'inset-x-0 bottom-0' : 'inset-y-0 left-0'
            )}
            style={
              isVertical
                ? { height: `${displayVolume * 100}%` }
                : { width: `${displayVolume * 100}%` }
            }
          />

          {/* Thumb */}
          <div
            className={cn(
              'absolute rounded-full bg-white border-2 border-accent',
              'shadow-lg transition-transform duration-150',
              'opacity-0 group-hover:opacity-100 hover:scale-110',
              'w-3 h-3',
              showGlow && 'shadow-[0_0_8px_rgba(16,185,129,0.5)]',
              isVertical ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2'
            )}
            style={
              isVertical
                ? { bottom: `calc(${displayVolume * 100}% - 6px)` }
                : { left: `calc(${displayVolume * 100}% - 6px)` }
            }
          />
        </div>
      </div>
    );
  }
);

VolumeSlider.displayName = 'VolumeSlider';

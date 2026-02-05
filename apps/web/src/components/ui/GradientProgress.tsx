'use client';

import { forwardRef, useCallback, useRef, type MouseEvent } from 'react';
import { cn } from '../../lib/utils';

interface GradientProgressProps {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  showGlow?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  trackClassName?: string;
  animated?: boolean;
}

const SIZE_CLASSES = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const GradientProgress = forwardRef<HTMLDivElement, GradientProgressProps>(
  ({
    value,
    max = 100,
    onChange,
    showGlow = true,
    size = 'md',
    className,
    trackClassName,
    animated = false,
  }, ref) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const progress = Math.min(100, Math.max(0, (value / max) * 100));

    const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
      if (!onChange || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newValue = Math.max(0, Math.min(max, clickPosition * max));

      onChange(newValue);
    }, [onChange, max]);

    const handleDrag = useCallback((e: MouseEvent<HTMLDivElement>) => {
      if (e.buttons !== 1 || !onChange || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const dragPosition = (e.clientX - rect.left) / rect.width;
      const newValue = Math.max(0, Math.min(max, dragPosition * max));

      onChange(newValue);
    }, [onChange, max]);

    return (
      <div ref={ref} className={cn('relative w-full', className)}>
        <div
          ref={trackRef}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          className={cn(
            'w-full rounded-full bg-white/20 overflow-hidden',
            onChange && 'cursor-pointer',
            SIZE_CLASSES[size],
            trackClassName
          )}
          onClick={handleClick}
          onMouseMove={handleDrag}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-150 ease-out',
              'bg-gradient-to-r from-primary via-primary-light to-accent',
              showGlow && 'shadow-[0_0_10px_rgba(108,99,255,0.5),0_0_20px_rgba(16,185,129,0.3)]',
              animated && 'animate-shimmer bg-[length:200%_100%]'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Thumb indicator when interactive */}
        {onChange && (
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full',
              'bg-white shadow-lg border-2 border-primary',
              'transition-transform duration-150 hover:scale-110',
              showGlow && 'shadow-[0_0_10px_rgba(108,99,255,0.5)]'
            )}
            style={{
              left: `calc(${progress}% - 8px)`,
              opacity: progress > 0 ? 1 : 0,
            }}
          />
        )}
      </div>
    );
  }
);

GradientProgress.displayName = 'GradientProgress';

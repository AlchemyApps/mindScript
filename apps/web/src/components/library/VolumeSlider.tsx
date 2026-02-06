'use client';

import { useCallback, useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VolumeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  onChange: (value: number) => void;
  /** Tailwind gradient class for the filled portion, e.g. "from-primary to-primary-light" */
  color?: string;
  /** Lucide icon component */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function VolumeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
  color = 'from-primary to-primary-light',
  icon,
  disabled = false,
}: VolumeSliderProps) {
  const id = useId();
  const isDefault = value === defaultValue;

  // Calculate the fill percentage for the gradient track
  const fillPercent = ((value - min) / (max - min)) * 100;

  const handleReset = useCallback(() => {
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const formatDb = (db: number) => {
    if (db > 0) return `+${db}`;
    return `${db}`;
  };

  return (
    <div className={cn('group', disabled && 'opacity-40 pointer-events-none')}>
      {/* Header row: icon + label + dB value + reset */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-muted/60">{icon}</span>
          )}
          <label htmlFor={id} className="text-sm font-medium text-text">
            {label}
          </label>
        </div>

        <div className="flex items-center gap-2">
          {/* dB readout — the tactile centerpiece */}
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[3.5rem] px-2 py-0.5',
              'rounded-md text-xs font-mono font-semibold tabular-nums tracking-tight',
              'bg-gray-100 text-text transition-colors duration-150',
              value > 0 && 'bg-amber-50 text-amber-700',
              value <= min + 2 && 'bg-gray-50 text-muted',
            )}
          >
            {formatDb(value)} dB
          </span>

          {/* Reset button — only visible when value differs from default */}
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              'p-1 rounded-md transition-all duration-200',
              isDefault
                ? 'text-transparent pointer-events-none'
                : 'text-muted/50 hover:text-primary hover:bg-primary/5'
            )}
            aria-label={`Reset ${label} to ${formatDb(defaultValue)} dB`}
            tabIndex={isDefault ? -1 : 0}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slider track */}
      <div className="relative h-8 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-gray-100 overflow-hidden">
          {/* Filled portion with gradient */}
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-100', color)}
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {/* Native range input — stretched over the track */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            'volume-slider-input absolute inset-x-0 w-full h-8 appearance-none bg-transparent cursor-pointer',
            'focus-visible:outline-none',
          )}
          style={{
            // CSS custom property used by the thumb styling
            '--fill': `${fillPercent}%`,
          } as React.CSSProperties}
        />
      </div>

      {/* Min/max labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted/40 tabular-nums">{formatDb(min)}</span>
        <span className="text-[10px] text-muted/40 tabular-nums">{formatDb(max)}</span>
      </div>
    </div>
  );
}

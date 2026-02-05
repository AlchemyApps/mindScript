'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { PlayIcon, PauseIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type ButtonSize = 'sm' | 'md' | 'lg';

interface PlayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isPlaying: boolean;
  size?: ButtonSize;
  breathing?: boolean;
  glow?: boolean;
}

const SIZE_CONFIG: Record<ButtonSize, { button: string; icon: string }> = {
  sm: { button: 'h-10 w-10', icon: 'h-4 w-4' },
  md: { button: 'h-14 w-14', icon: 'h-6 w-6' },
  lg: { button: 'h-18 w-18', icon: 'h-8 w-8' },
};

export const PlayButton = forwardRef<HTMLButtonElement, PlayButtonProps>(
  ({ isPlaying, size = 'md', breathing = false, glow = true, className, ...props }, ref) => {
    const sizeConfig = SIZE_CONFIG[size];

    return (
      <button
        ref={ref}
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'relative rounded-full',
          'bg-gradient-to-br from-primary via-primary-light to-accent',
          'text-white',
          'flex items-center justify-center',
          'transition-all duration-300 ease-therapeutic',
          'hover:scale-105 active:scale-95',
          'focus-ring',
          sizeConfig.button,
          glow && 'shadow-[0_0_20px_rgba(108,99,255,0.4),0_0_40px_rgba(108,99,255,0.2)]',
          breathing && isPlaying && 'animate-breathe',
          className
        )}
        {...props}
      >
        {/* Inner glow ring */}
        <div className="absolute inset-1 rounded-full bg-white/10 blur-sm" />

        {/* Icon */}
        <div className="relative z-10">
          {isPlaying ? (
            <PauseIcon className={sizeConfig.icon} />
          ) : (
            <PlayIcon className={cn(sizeConfig.icon, 'ml-0.5')} />
          )}
        </div>
      </button>
    );
  }
);

PlayButton.displayName = 'PlayButton';

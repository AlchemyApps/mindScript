'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type GlassVariant = 'light' | 'dark';
type HoverEffect = 'lift' | 'glow' | 'both' | 'none';
type GlowColor = 'primary' | 'accent' | 'meditation' | 'sleep' | 'focus' | 'relaxation' | 'energy' | 'healing';

const GLOW_CLASSES: Record<GlowColor, string> = {
  primary: 'hover:shadow-[0_0_30px_rgba(108,99,255,0.3),0_0_60px_rgba(108,99,255,0.1)]',
  accent: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.3),0_0_60px_rgba(16,185,129,0.1)]',
  meditation: 'hover:shadow-[0_0_30px_rgba(147,51,234,0.3),0_0_60px_rgba(147,51,234,0.1)]',
  sleep: 'hover:shadow-[0_0_30px_rgba(99,102,241,0.3),0_0_60px_rgba(99,102,241,0.1)]',
  focus: 'hover:shadow-[0_0_30px_rgba(14,165,233,0.3),0_0_60px_rgba(14,165,233,0.1)]',
  relaxation: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.3),0_0_60px_rgba(34,197,94,0.1)]',
  energy: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.3),0_0_60px_rgba(245,158,11,0.1)]',
  healing: 'hover:shadow-[0_0_30px_rgba(236,72,153,0.3),0_0_60px_rgba(236,72,153,0.1)]',
};

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: GlassVariant;
  hover?: HoverEffect;
  glowColor?: GlowColor;
  noPadding?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, variant = 'light', hover = 'lift', glowColor = 'primary', noPadding = false, className, ...props }, ref) => {
    const baseClasses = variant === 'light' ? 'glass' : 'glass-dark';

    const hoverClasses = cn(
      hover === 'lift' && 'hover-lift',
      hover === 'glow' && GLOW_CLASSES[glowColor],
      hover === 'both' && ['hover-lift', GLOW_CLASSES[glowColor]],
    );

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          'rounded-2xl',
          !noPadding && 'p-6',
          'transition-all duration-300',
          hoverClasses,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

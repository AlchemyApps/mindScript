'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'accent' | 'warm';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  breathing?: boolean;
  glow?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90',
  accent: 'bg-gradient-to-r from-accent to-accent-light hover:from-accent/90 hover:to-accent-light/90',
  warm: 'bg-gradient-to-r from-warm-gold to-soft hover:from-warm-gold/90 hover:to-soft/90',
};

const GLOW_CLASSES: Record<ButtonVariant, string> = {
  primary: 'shadow-[0_0_20px_rgba(108,99,255,0.4),0_0_40px_rgba(108,99,255,0.2)]',
  accent: 'shadow-[0_0_20px_rgba(16,185,129,0.4),0_0_40px_rgba(16,185,129,0.2)]',
  warm: 'shadow-[0_0_20px_rgba(217,119,6,0.4),0_0_40px_rgba(253,230,138,0.2)]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-base rounded-xl',
  lg: 'px-8 py-4 text-lg rounded-2xl',
};

export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({
    children,
    variant = 'primary',
    size = 'md',
    breathing = false,
    glow = false,
    fullWidth = false,
    className,
    disabled,
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'font-semibold text-white',
          'transition-all duration-300 ease-therapeutic',
          'focus-ring',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          glow && GLOW_CLASSES[variant],
          breathing && 'animate-breathe',
          fullWidth && 'w-full',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'hover:scale-[1.02] active:scale-[0.98]',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GradientButton.displayName = 'GradientButton';

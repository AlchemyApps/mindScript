'use client';

import { cn } from '../../lib/utils';

interface FloatingOrbsProps {
  className?: string;
  variant?: 'hero' | 'subtle' | 'vibrant';
}

export function FloatingOrbs({ className, variant = 'hero' }: FloatingOrbsProps) {
  const orbConfigs = {
    hero: [
      { size: 'w-96 h-96', position: 'top-0 -left-48', color: 'bg-soft-lavender', opacity: 'opacity-60', animation: 'animate-float' },
      { size: 'w-[500px] h-[500px]', position: 'top-1/4 -right-64', color: 'bg-calm-mint', opacity: 'opacity-40', animation: 'animate-float-delayed' },
      { size: 'w-72 h-72', position: 'bottom-0 left-1/4', color: 'bg-soft', opacity: 'opacity-30', animation: 'animate-float-slow' },
      { size: 'w-64 h-64', position: 'top-1/2 right-1/4', color: 'bg-primary-light', opacity: 'opacity-20', animation: 'animate-float' },
      { size: 'w-48 h-48', position: 'bottom-1/4 -left-24', color: 'bg-accent-light', opacity: 'opacity-30', animation: 'animate-float-delayed' },
    ],
    subtle: [
      { size: 'w-64 h-64', position: 'top-0 right-0', color: 'bg-soft-lavender', opacity: 'opacity-30', animation: 'animate-float-slow' },
      { size: 'w-48 h-48', position: 'bottom-0 left-0', color: 'bg-calm-mint', opacity: 'opacity-25', animation: 'animate-float' },
    ],
    vibrant: [
      { size: 'w-96 h-96', position: '-top-24 -left-24', color: 'bg-primary', opacity: 'opacity-20', animation: 'animate-float' },
      { size: 'w-80 h-80', position: 'top-1/3 -right-40', color: 'bg-accent', opacity: 'opacity-15', animation: 'animate-float-delayed' },
      { size: 'w-72 h-72', position: 'bottom-0 left-1/3', color: 'bg-soft', opacity: 'opacity-40', animation: 'animate-float-slow' },
      { size: 'w-56 h-56', position: 'top-2/3 right-1/4', color: 'bg-primary-light', opacity: 'opacity-25', animation: 'animate-breathe' },
    ],
  };

  const orbs = orbConfigs[variant];

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {orbs.map((orb, index) => (
        <div
          key={index}
          className={cn(
            'absolute rounded-full blur-3xl',
            orb.size,
            orb.position,
            orb.color,
            orb.opacity,
            orb.animation
          )}
          style={{
            animationDelay: `${index * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

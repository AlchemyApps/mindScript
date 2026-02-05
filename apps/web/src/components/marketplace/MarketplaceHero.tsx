'use client';

import { SearchIcon, TrendingUpIcon } from 'lucide-react';
import { FloatingOrbs } from '../landing/FloatingOrbs';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';

interface MarketplaceHeroProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  trendingTags?: string[];
  onTagClick?: (tag: string) => void;
}

export function MarketplaceHero({
  searchValue,
  onSearchChange,
  trendingTags = ['meditation', 'sleep', 'focus', 'relaxation', 'healing'],
  onTagClick,
}: MarketplaceHeroProps) {
  return (
    <section className="relative overflow-hidden bg-hero-gradient py-16 md:py-24">
      <FloatingOrbs variant="hero" />

      <div className="relative z-10 container mx-auto px-4">
        {/* Headline */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-gradient">Discover Your Sound</span>
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto">
            Explore curated audio experiences crafted for meditation, focus, sleep, and healing
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <GlassCard hover="glow" glowColor="primary" noPadding className="p-2">
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-4 h-5 w-5 text-muted" />
              <input
                type="text"
                placeholder="Search tracks, categories, or creators..."
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className={cn(
                  'w-full py-4 pl-12 pr-4 rounded-xl',
                  'bg-transparent',
                  'text-lg placeholder:text-muted',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30',
                  'transition-all duration-300'
                )}
              />
            </div>
          </GlassCard>
        </div>

        {/* Trending Tags */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="flex items-center gap-1 text-sm text-muted">
            <TrendingUpIcon className="h-4 w-4" />
            Trending:
          </span>
          {trendingTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick?.(tag)}
              className={cn(
                'px-4 py-2 rounded-full',
                'glass hover:glass-dark',
                'text-sm font-medium capitalize',
                'hover:scale-105 active:scale-95',
                'transition-all duration-200',
                'border border-white/20 hover:border-primary/30'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

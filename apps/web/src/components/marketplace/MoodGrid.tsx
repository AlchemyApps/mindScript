'use client';

import {
  SunMediumIcon,
  MoonIcon,
  BrainIcon,
  HeartIcon,
  ZapIcon,
  SparklesIcon,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';
import type { MarketplaceCategory, CategoryWithCount } from '@mindscript/schemas';

interface MoodGridProps {
  categories: CategoryWithCount[];
  selectedCategory?: MarketplaceCategory;
  onCategorySelect: (category: MarketplaceCategory | undefined) => void;
}

const CATEGORY_CONFIG: Record<
  string,
  {
    icon: typeof SunMediumIcon;
    gradient: string;
    glowColor: 'meditation' | 'sleep' | 'focus' | 'relaxation' | 'energy' | 'healing';
    description: string;
  }
> = {
  meditation: {
    icon: SunMediumIcon,
    gradient: 'from-purple-500/20 to-purple-600/20',
    glowColor: 'meditation',
    description: 'Find inner peace and mindfulness',
  },
  sleep: {
    icon: MoonIcon,
    gradient: 'from-indigo-500/20 to-indigo-600/20',
    glowColor: 'sleep',
    description: 'Drift into restful slumber',
  },
  focus: {
    icon: BrainIcon,
    gradient: 'from-sky-500/20 to-sky-600/20',
    glowColor: 'focus',
    description: 'Sharpen concentration and clarity',
  },
  relaxation: {
    icon: HeartIcon,
    gradient: 'from-emerald-500/20 to-emerald-600/20',
    glowColor: 'relaxation',
    description: 'Release tension and stress',
  },
  energy: {
    icon: ZapIcon,
    gradient: 'from-amber-500/20 to-amber-600/20',
    glowColor: 'energy',
    description: 'Boost vitality and motivation',
  },
  healing: {
    icon: SparklesIcon,
    gradient: 'from-pink-500/20 to-pink-600/20',
    glowColor: 'healing',
    description: 'Restore balance and wellness',
  },
};

export function MoodGrid({ categories, selectedCategory, onCategorySelect }: MoodGridProps) {
  // Ensure we display categories in a consistent order
  const orderedCategories = ['meditation', 'sleep', 'focus', 'relaxation', 'energy', 'healing'];

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            <span className="text-gradient-static">Browse by Mood</span>
          </h2>
          <p className="text-muted">Select a category to explore</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {orderedCategories.map((categoryKey) => {
            const config = CATEGORY_CONFIG[categoryKey];
            if (!config) return null;

            const categoryData = categories.find((c) => c.category === categoryKey);
            const count = categoryData?.count || 0;
            const Icon = config.icon;
            const isSelected = selectedCategory === categoryKey;

            return (
              <button
                key={categoryKey}
                onClick={() =>
                  onCategorySelect(
                    isSelected ? undefined : (categoryKey as MarketplaceCategory)
                  )
                }
                className="text-left w-full"
              >
                <GlassCard
                  hover="both"
                  glowColor={config.glowColor}
                  className={cn(
                    'h-full transition-all duration-300',
                    isSelected && 'ring-2 ring-primary scale-[1.02]',
                    `bg-gradient-to-br ${config.gradient}`
                  )}
                >
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                        'bg-white/30 backdrop-blur-sm',
                        'transition-transform duration-300',
                        'group-hover:animate-breathe'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-6 w-6 transition-colors',
                          isSelected ? 'text-primary' : 'text-current'
                        )}
                      />
                    </div>

                    <h3 className="font-semibold capitalize mb-1">{categoryKey}</h3>

                    <p className="text-xs text-muted line-clamp-2 mb-2">
                      {config.description}
                    </p>

                    <span className="text-xs font-medium text-primary/80">
                      {count} {count === 1 ? 'track' : 'tracks'}
                    </span>
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>

        {/* Clear filter button */}
        {selectedCategory && (
          <div className="text-center mt-6">
            <button
              onClick={() => onCategorySelect(undefined)}
              className={cn(
                'px-6 py-2 rounded-full text-sm',
                'glass hover:glass-dark',
                'transition-all duration-200'
              )}
            >
              Clear filter
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

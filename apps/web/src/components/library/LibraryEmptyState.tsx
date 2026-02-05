'use client';

import { FolderOpenIcon, SparklesIcon, ShoppingBagIcon } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { FloatingOrbs } from '../landing/FloatingOrbs';

interface LibraryEmptyStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreateTrack: () => void;
  onBrowseMarketplace: () => void;
}

export function LibraryEmptyState({
  hasActiveFilters,
  onClearFilters,
  onCreateTrack,
  onBrowseMarketplace,
}: LibraryEmptyStateProps) {
  return (
    <div className="relative py-12">
      <FloatingOrbs variant="subtle" />

      <GlassCard hover="none" className="max-w-lg mx-auto text-center relative z-10">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-soft-lavender/50 flex items-center justify-center">
          <FolderOpenIcon className="h-10 w-10 text-primary" />
        </div>

        <h2 className="text-2xl font-bold mb-2">
          <span className="text-gradient">No tracks found</span>
        </h2>

        <p className="text-muted mb-6">
          {hasActiveFilters
            ? 'Try adjusting your filters to see more tracks'
            : 'Start creating or purchasing tracks to build your personal audio library'}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {hasActiveFilters && (
            <GradientButton variant="warm" onClick={onClearFilters}>
              Clear Filters
            </GradientButton>
          )}

          <GradientButton
            variant="primary"
            glow
            breathing
            onClick={onCreateTrack}
          >
            <SparklesIcon className="h-4 w-4 mr-2" />
            Create a Track
          </GradientButton>

          <GradientButton variant="accent" onClick={onBrowseMarketplace}>
            <ShoppingBagIcon className="h-4 w-4 mr-2" />
            Browse Marketplace
          </GradientButton>
        </div>
      </GlassCard>
    </div>
  );
}

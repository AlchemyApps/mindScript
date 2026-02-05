"use client";

import { useState, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@mindscript/ui";
import { TrackCard } from "./TrackCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import type { FeaturedTracks, Publication } from "@mindscript/schemas";

interface FeaturedCarouselProps {
  tracks: FeaturedTracks;
  onTrackClick: (trackId: string) => void;
}

export function FeaturedCarousel({ tracks, onTrackClick }: FeaturedCarouselProps) {
  const [activeSection, setActiveSection] = useState<"featured" | "popular" | "new">("featured");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sections = [
    { key: "featured" as const, title: "Featured Tracks", tracks: tracks.featured },
    { key: "popular" as const, title: "Popular Tracks", tracks: tracks.popular },
    { key: "new" as const, title: "New Releases", tracks: tracks.new_releases },
  ];

  const activeData = sections.find(s => s.key === activeSection);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-6 border-b border-white/10 pb-1">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={cn(
              'pb-3 px-1 text-sm font-medium transition-all relative',
              activeSection === section.key
                ? 'text-primary'
                : 'text-muted hover:text-foreground'
            )}
          >
            {section.title}
            {/* Gradient underline indicator */}
            {activeSection === section.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Carousel */}
      {activeData && activeData.tracks.length > 0 && (
        <div className="relative group">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          {/* Navigation buttons */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scroll('left')}
            className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 z-20',
              'h-10 w-10 p-0 rounded-full',
              'glass opacity-0 group-hover:opacity-100',
              'transition-all duration-300',
              'hover:glow-primary'
            )}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => scroll('right')}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 z-20',
              'h-10 w-10 p-0 rounded-full',
              'glass opacity-0 group-hover:opacity-100',
              'transition-all duration-300',
              'hover:glow-primary'
            )}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </Button>

          {/* Track cards */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-2 -mx-2 scroll-smooth"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {activeData.tracks.map((track) => (
              <div
                key={track.id}
                className="flex-shrink-0 w-72"
                style={{ scrollSnapAlign: 'start' }}
              >
                <TrackCard
                  track={track as Publication & { formatted_price?: string }}
                  onClick={onTrackClick}
                  variant="grid"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeData && activeData.tracks.length === 0 && (
        <GlassCard hover="none" className="text-center py-12">
          <p className="text-muted">No tracks available in this section</p>
        </GlassCard>
      )}
    </div>
  );
}

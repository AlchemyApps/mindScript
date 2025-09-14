"use client";

import { useState } from "react";
import { Card } from "@mindscript/ui";
import { Button } from "@mindscript/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { TrackCard } from "./TrackCard";
import type { FeaturedTracks, Publication } from "@mindscript/schemas";

interface FeaturedCarouselProps {
  tracks: FeaturedTracks;
  onTrackClick: (trackId: string) => void;
}

export function FeaturedCarousel({ tracks, onTrackClick }: FeaturedCarouselProps) {
  const [activeSection, setActiveSection] = useState<"featured" | "popular" | "new">("featured");

  const sections = [
    { key: "featured" as const, title: "Featured Tracks", tracks: tracks.featured },
    { key: "popular" as const, title: "Popular Tracks", tracks: tracks.popular },
    { key: "new" as const, title: "New Releases", tracks: tracks.new_releases },
  ];

  const activeData = sections.find(s => s.key === activeSection);

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-4 border-b">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
              activeSection === section.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {section.title}
          </button>
        ))}
      </div>

      {/* Carousel */}
      {activeData && activeData.tracks.length > 0 && (
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {activeData.tracks.map((track) => (
              <div key={track.id} className="flex-shrink-0 w-72">
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
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No tracks available in this section</p>
        </Card>
      )}
    </div>
  );
}
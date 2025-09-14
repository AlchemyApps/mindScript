"use client";

import { TrackCard } from "./TrackCard";
import type { Publication } from "@mindscript/schemas";

interface TrackGridProps {
  tracks: (Publication & { 
    formatted_price?: string;
    seller?: {
      display_name: string;
      avatar_url?: string;
    };
  })[];
  onTrackClick: (trackId: string) => void;
}

export function TrackGrid({ tracks, onTrackClick }: TrackGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          onClick={onTrackClick}
          variant="grid"
        />
      ))}
    </div>
  );
}
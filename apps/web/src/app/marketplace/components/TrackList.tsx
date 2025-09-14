"use client";

import { TrackCard } from "./TrackCard";
import type { Publication } from "@mindscript/schemas";

interface TrackListProps {
  tracks: (Publication & { 
    formatted_price?: string;
    seller?: {
      display_name: string;
      avatar_url?: string;
    };
  })[];
  onTrackClick: (trackId: string) => void;
}

export function TrackList({ tracks, onTrackClick }: TrackListProps) {
  return (
    <div className="space-y-4 list-view">
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          onClick={onTrackClick}
          variant="list"
        />
      ))}
    </div>
  );
}
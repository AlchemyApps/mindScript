"use client";

import { Badge } from "@mindscript/ui";
import { Button } from "@mindscript/ui";
import { PlayIcon, PauseIcon, ShoppingCartIcon } from "lucide-react";
import { formatDuration, getCategoryIcon } from "@mindscript/schemas";
import type { Publication } from "@mindscript/schemas";
import { useCartStore } from "../../../store/cartStore";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientButton } from "@/components/ui/GradientButton";

// Category-specific glow colors
const CATEGORY_GLOWS: Record<string, 'meditation' | 'sleep' | 'focus' | 'relaxation' | 'energy' | 'healing' | 'primary'> = {
  meditation: 'meditation',
  sleep: 'sleep',
  focus: 'focus',
  relaxation: 'relaxation',
  energy: 'energy',
  healing: 'healing',
};

interface TrackCardProps {
  track: Publication & {
    formatted_price?: string;
    preview_url?: string;
    seller?: {
      display_name: string;
      avatar_url?: string;
    };
  };
  onClick: (trackId: string) => void;
  variant?: "grid" | "list";
}

export function TrackCard({ track, onClick, variant = "grid" }: TrackCardProps) {
  const addToCart = useCartStore((state) => state.addItem);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const glowColor = CATEGORY_GLOWS[track.category] || 'primary';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      trackId: track.id,
      title: track.title,
      price: track.priceWebCents,
      sellerId: track.sellerId,
      sellerName: track.seller?.display_name || "Unknown",
      imageUrl: track.coverImageUrl,
    });
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!track.preview_url) {
      console.log("No preview available for track:", track.id);
      return;
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      const audio = new Audio(track.preview_url);
      audio.volume = 0.7;
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      audio.addEventListener('error', (e) => {
        console.error('Preview playback error:', e);
        setIsPlaying(false);
      });

      audio.play();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (variant === "list") {
    return (
      <GlassCard
        hover="both"
        glowColor={glowColor}
        noPadding
        className="cursor-pointer"
        onClick={() => onClick(track.id)}
      >
        <div className="flex items-center p-4 gap-4">
          {/* Thumbnail */}
          {track.coverImageUrl && (
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-soft-lavender/30 flex-shrink-0 shadow-lg">
              <img
                src={track.coverImageUrl}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold truncate">{track.title}</h3>
                <p className="text-sm text-muted truncate">
                  by {track.seller?.display_name || "Unknown"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs bg-soft-lavender/50">
                    {getCategoryIcon(track.category)} {track.category}
                  </Badge>
                  <span className="text-xs text-muted">
                    {formatDuration(track.durationMinutes * 60)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePreview}
                  className={cn(
                    "h-10 w-10 p-0 rounded-full",
                    isPlaying && "glow-primary animate-breathe"
                  )}
                  disabled={!track.preview_url}
                  title={track.preview_url ? "Preview track" : "No preview available"}
                >
                  {isPlaying ? (
                    <PauseIcon className="h-4 w-4" />
                  ) : (
                    <PlayIcon className="h-4 w-4" />
                  )}
                </Button>
                <div className="text-right">
                  <div className="font-semibold text-primary">
                    {track.formatted_price || `$${(track.priceWebCents / 100).toFixed(2)}`}
                  </div>
                  <GradientButton
                    size="sm"
                    variant="accent"
                    onClick={handleAddToCart}
                    className="h-7 text-xs mt-1"
                  >
                    <ShoppingCartIcon className="h-3 w-3 mr-1" />
                    Add
                  </GradientButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  // Grid view
  return (
    <GlassCard
      hover="both"
      glowColor={glowColor}
      noPadding
      className="cursor-pointer h-full flex flex-col overflow-hidden"
      onClick={() => onClick(track.id)}
    >
      {/* Image */}
      {track.coverImageUrl && (
        <div className="aspect-square overflow-hidden bg-soft-lavender/30 relative group">
          <img
            src={track.coverImageUrl}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
            <Button
              size="lg"
              onClick={handlePreview}
              disabled={!track.preview_url}
              className={cn(
                "h-14 w-14 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300",
                "bg-gradient-to-br from-primary to-accent text-white",
                isPlaying && "opacity-100 animate-breathe glow-primary"
              )}
              title={track.preview_url ? "Preview track" : "No preview available"}
            >
              {isPlaying ? (
                <PauseIcon className="h-6 w-6" />
              ) : (
                <PlayIcon className="h-6 w-6 ml-1" />
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-lg line-clamp-2">{track.title}</h3>
        </div>
        <p className="text-sm text-muted mb-3">
          by {track.seller?.display_name || "Unknown"}
        </p>

        {/* Description */}
        <p className="text-sm text-muted/80 line-clamp-2 mb-3">
          {track.description}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className="text-xs bg-soft-lavender/50">
            {getCategoryIcon(track.category)} {track.category}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {formatDuration(track.durationMinutes * 60)}
          </Badge>
        </div>

        {/* Price and CTA */}
        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="flex items-center justify-between w-full">
            <span className="text-xl font-bold text-gradient-static">
              {track.formatted_price || `$${(track.priceWebCents / 100).toFixed(2)}`}
            </span>
            <GradientButton
              size="sm"
              variant="accent"
              glow
              onClick={handleAddToCart}
            >
              <ShoppingCartIcon className="h-4 w-4 mr-2" />
              Add to Cart
            </GradientButton>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

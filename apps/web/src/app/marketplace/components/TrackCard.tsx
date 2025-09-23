"use client";

import { Card, CardContent, CardHeader } from "@mindscript/ui";
import { Button } from "@mindscript/ui";
import { Badge } from "@mindscript/ui";
import { PlayIcon, PauseIcon, ShoppingCartIcon } from "lucide-react";
import { formatDuration, getCategoryIcon } from "@mindscript/schemas";
import type { Publication } from "@mindscript/schemas";
import { useCartStore } from "../../../store/cartStore";
import { useRef, useState, useEffect } from "react";

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
      // Create audio element if it doesn't exist
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

  // Cleanup audio on unmount
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
      <Card 
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => onClick(track.id)}
      >
        <div className="flex items-center p-4 gap-4">
          {/* Thumbnail */}
          {track.coverImageUrl && (
            <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
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
                <p className="text-sm text-muted-foreground truncate">
                  by {track.seller?.display_name || "Unknown"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryIcon(track.category)} {track.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
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
                  className="h-8 w-8 p-0"
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
                  <div className="font-semibold">
                    {track.formatted_price || `$${(track.priceWebCents / 100).toFixed(2)}`}
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleAddToCart}
                    className="h-7 text-xs"
                  >
                    <ShoppingCartIcon className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col"
      onClick={() => onClick(track.id)}
    >
      {/* Image */}
      {track.coverImageUrl && (
        <div className="aspect-square rounded-t-lg overflow-hidden bg-muted">
          <img
            src={track.coverImageUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg line-clamp-2">{track.title}</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePreview}
            className="h-8 w-8 p-0 flex-shrink-0"
            disabled={!track.preview_url}
            title={track.preview_url ? "Preview track" : "No preview available"}
          >
            {isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          by {track.seller?.display_name || "Unknown"}
        </p>
      </CardHeader>
      
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {track.description}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            {getCategoryIcon(track.category)} {track.category}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {formatDuration(track.durationMinutes * 60)}
          </Badge>
        </div>
      </CardContent>
      
      <div className="p-6 pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          <span className="text-lg font-semibold">
            {track.formatted_price || `$${(track.priceWebCents / 100).toFixed(2)}`}
          </span>
          <Button size="sm" onClick={handleAddToCart}>
            <ShoppingCartIcon className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        </div>
      </div>
    </Card>
  );
}
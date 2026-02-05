'use client';

import { Badge, Button } from '@mindscript/ui';
import {
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  EditIcon,
  MusicIcon,
  ClockIcon,
  TagIcon,
} from 'lucide-react';
import { formatDuration } from '@mindscript/schemas';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';
import { GradientProgress } from '../ui/GradientProgress';

type ViewMode = 'grid' | 'list';

interface Track {
  id: string;
  title: string;
  description?: string;
  duration: number;
  tags?: string[];
  status: 'draft' | 'rendering' | 'published' | 'failed';
  cover_image_url?: string;
  audio_url?: string;
  audio_signed_url?: string;
  created_at: string;
  updated_at: string;
  ownership: 'owned' | 'purchased';
  purchasedAt?: string;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
  renderStatus?: {
    id: string;
    status: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
  };
}

interface LibraryTrackCardProps {
  track: Track;
  viewMode: ViewMode;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onDownload: () => void;
  onEdit: () => void;
}

const STATUS_COLORS: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default'; glow?: string }> = {
  published: { variant: 'success', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]' },
  rendering: { variant: 'warning', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.4)]' },
  failed: { variant: 'destructive', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]' },
  draft: { variant: 'secondary' },
};

function WaveformPlaceholder({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-center gap-[2px] h-8">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full bg-gradient-to-t from-primary to-accent',
            'transition-all duration-300',
            isPlaying && 'animate-pulse'
          )}
          style={{
            height: `${20 + Math.sin(i * 0.8) * 15 + (isPlaying ? Math.random() * 10 : 0)}px`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

export function LibraryTrackCard({
  track,
  viewMode,
  isCurrentTrack,
  isPlaying,
  onPlay,
  onDownload,
  onEdit,
}: LibraryTrackCardProps) {
  const audioUrl = track.audio_signed_url || track.audio_url;
  const canPlay = !!audioUrl;
  const statusConfig = STATUS_COLORS[track.status] || { variant: 'default' as const };

  const renderRenderProgress = () => {
    if (track.status !== 'rendering') return null;

    const progress = Math.max(0, Math.min(100, track.renderStatus?.progress ?? 0));
    const stage = track.renderStatus?.status
      ? track.renderStatus.status.replace(/_/g, ' ')
      : 'Preparing render';

    return (
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="capitalize">{stage}</span>
          <span>{progress}%</span>
        </div>
        <GradientProgress value={progress} max={100} size="sm" animated />
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <GlassCard hover="both" glowColor="primary" className="p-4">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-soft-lavender/30 flex-shrink-0 flex items-center justify-center shadow-inner">
            {track.cover_image_url ? (
              <img
                src={track.cover_image_url}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <MusicIcon className="h-8 w-8 text-primary/60" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{track.title}</h3>
              <Badge
                variant={statusConfig.variant}
                className={cn('text-xs', statusConfig.glow)}
              >
                {track.status}
              </Badge>
              {track.ownership === 'purchased' && (
                <Badge variant="outline" className="text-xs">
                  Purchased
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted">
              {track.profiles?.display_name || 'Unknown Artist'} • {formatDuration(track.duration)}
            </p>
            {track.tags && track.tags.length > 0 && (
              <div className="flex gap-1 mt-1">
                {track.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs bg-soft-lavender/50">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {renderRenderProgress()}
          </div>

          {/* Waveform */}
          <div className="hidden md:block">
            <WaveformPlaceholder isPlaying={isCurrentTrack && isPlaying} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {canPlay && (
              <Button
                size="sm"
                variant={isCurrentTrack ? 'default' : 'ghost'}
                onClick={onPlay}
                className={cn(
                  'h-10 w-10 p-0 rounded-full',
                  isCurrentTrack && isPlaying && 'animate-breathe glow-primary'
                )}
              >
                {isCurrentTrack && isPlaying ? (
                  <PauseIcon className="h-4 w-4" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
              </Button>
            )}
            {audioUrl && (
              <Button size="sm" variant="ghost" onClick={onDownload} className="h-10 w-10 p-0 rounded-lg border border-white/10 hover:border-white/20">
                <DownloadIcon className="h-5 w-5" />
              </Button>
            )}
            {track.ownership === 'owned' && (
              <Button size="sm" variant="ghost" onClick={onEdit} className="h-10 w-10 p-0 rounded-lg border border-white/10 hover:border-white/20">
                <EditIcon className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </GlassCard>
    );
  }

  // Grid view
  return (
    <GlassCard hover="both" glowColor="primary" noPadding className="h-full flex flex-col overflow-hidden">
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-soft-lavender/30 flex items-center justify-center relative group">
        {track.cover_image_url ? (
          <img
            src={track.cover_image_url}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <MusicIcon className="h-12 w-12 text-primary/40" />
        )}

        {/* Persistent play indicator */}
        {canPlay && (
          <button
            onClick={onPlay}
            className={cn(
              'absolute bottom-2 right-2 h-10 w-10 rounded-full flex items-center justify-center',
              'bg-black/50 backdrop-blur-sm',
              'text-white opacity-70 hover:opacity-100 transition-all duration-300',
              'hover:scale-110',
              isCurrentTrack && isPlaying && 'opacity-100 bg-primary animate-breathe'
            )}
          >
            {isCurrentTrack && isPlaying ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5 ml-0.5" />
            )}
          </button>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <h3 className="font-semibold text-sm line-clamp-1">{track.title}</h3>
        </div>
        <p className="text-xs text-muted mb-2">
          {track.profiles?.display_name || 'Unknown Artist'}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Badge
            variant={statusConfig.variant}
            className={cn('text-xs', statusConfig.glow)}
          >
            {track.status}
          </Badge>
          {track.ownership === 'purchased' && (
            <Badge variant="outline" className="text-xs">
              Purchased
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs bg-soft-lavender/50">
            <ClockIcon className="h-3 w-3 mr-1" />
            {formatDuration(track.duration)}
          </Badge>
        </div>

        {/* Tags */}
        {track.tags && track.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {track.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <TagIcon className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Render progress */}
        {renderRenderProgress()}

        {/* Actions */}
        <div className="flex gap-1.5 mt-auto pt-3">
          {audioUrl && (
            <Button size="sm" variant="outline" onClick={onDownload} className="flex-1 glass text-xs">
              <DownloadIcon className="h-3 w-3 mr-1" />
              Download
            </Button>
          )}
          {track.ownership === 'owned' && (
            <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 glass text-xs">
              <EditIcon className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

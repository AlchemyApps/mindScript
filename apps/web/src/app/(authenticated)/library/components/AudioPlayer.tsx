'use client';

import { useEffect, useRef, useMemo } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
  RepeatIcon,
  ShuffleIcon,
  Maximize2Icon,
} from 'lucide-react';
import { Button } from '@mindscript/ui';
import { usePlayerStore } from '@/store/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';

type AudioPlayerMode = 'mini' | 'full';

interface AudioPlayerProps {
  mode?: AudioPlayerMode;
  onExpand?: () => void;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${secs}`;
};

export function AudioPlayer({ mode = 'full', onExpand }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    currentTrack,
    isPlaying,
    playNext,
    playPrevious,
    togglePlayPause,
    currentTime,
    duration,
    setCurrentTime,
    setDuration,
    repeatMode,
    toggleRepeat,
    shuffleMode,
    toggleShuffle,
    volume,
    setVolume,
    isMuted,
    toggleMute,
  } = usePlayerStore(useShallow(state => ({
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    playNext: state.playNext,
    playPrevious: state.playPrevious,
    togglePlayPause: state.togglePlayPause,
    currentTime: state.currentTime,
    duration: state.duration || state.currentTrack?.duration || 0,
    setCurrentTime: state.setCurrentTime,
    setDuration: state.setDuration,
    repeatMode: state.repeatMode,
    toggleRepeat: state.toggleRepeat,
    shuffleMode: state.shuffleMode,
    toggleShuffle: state.toggleShuffle,
    volume: state.volume,
    setVolume: state.setVolume,
    isMuted: state.isMuted,
    toggleMute: state.toggleMute,
  })));

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.src = currentTrack.url;
    audio.load();

    if (isPlaying) {
      audio
        .play()
        .catch(error => console.error('[AudioPlayer] Playback failed:', error));
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      return;
    }

    if (isPlaying) {
      audio
        .play()
        .catch(error => console.error('[AudioPlayer] Playback error:', error));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(Math.floor(audio.duration));
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value;
    setVolume(value);
  };

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  }, [currentTime, duration]);

  if (!currentTrack) {
    return null;
  }

  const renderControls = () => (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Previous"
        className="p-2 rounded-full hover:bg-muted"
        onClick={playPrevious}
      >
        <SkipBackIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={togglePlayPause}
      >
        {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
      </button>
      <button
        type="button"
        aria-label="Next"
        className="p-2 rounded-full hover:bg-muted"
        onClick={playNext}
      >
        <SkipForwardIcon className="h-5 w-5" />
      </button>
    </div>
  );

  const renderTimeControls = () => (
    <div className="flex items-center gap-3 w-full">
      <span className="text-xs text-muted-foreground min-w-[40px] text-right">
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        value={Math.min(currentTime, duration || 0)}
        step={0.1}
        onChange={e => handleSeek(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      <span className="text-xs text-muted-foreground min-w-[40px]">
        {formatTime(duration || 0)}
      </span>
    </div>
  );

  const renderVolumeControls = () => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Toggle mute"
        className="p-2 rounded-full hover:bg-muted"
        onClick={toggleMute}
      >
        {isMuted ? <VolumeXIcon className="h-4 w-4" /> : <Volume2Icon className="h-4 w-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={isMuted ? 0 : volume}
        onChange={e => handleVolumeChange(parseFloat(e.target.value))}
        className="w-24 accent-primary"
      />
    </div>
  );

  if (mode === 'mini') {
    return (
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-semibold text-sm">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground">
              {currentTrack.artist || 'MindScript'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {renderControls()}
          {onExpand && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onExpand}
              aria-label="Expand player"
            >
              <Maximize2Icon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <audio
          ref={audioRef}
          hidden
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={playNext}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{currentTrack.title}</p>
          <p className="text-sm text-muted-foreground">
            {currentTrack.artist || 'MindScript'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle shuffle"
            className={cn(
              'p-2 rounded-full hover:bg-muted',
              shuffleMode && 'text-primary'
            )}
            onClick={toggleShuffle}
          >
            <ShuffleIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Toggle repeat"
            className={cn(
              'p-2 rounded-full hover:bg-muted',
              repeatMode !== 'none' && 'text-primary'
            )}
            onClick={toggleRepeat}
          >
            <RepeatIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {renderTimeControls()}

      <div className="flex items-center justify-between">
        {renderControls()}
        {renderVolumeControls()}
      </div>

      <audio
        ref={audioRef}
        hidden
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={playNext}
      />
    </div>
  );
}

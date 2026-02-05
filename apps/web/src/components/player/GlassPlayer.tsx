'use client';

import { useEffect, useRef, useMemo } from 'react';
import {
  SkipBackIcon,
  SkipForwardIcon,
  RepeatIcon,
  ShuffleIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';
import { PlayButton } from './PlayButton';
import { ProgressBar } from './ProgressBar';
import { VolumeSlider } from './VolumeSlider';
import { WaveformVisualizer } from './WaveformVisualizer';
import { FloatingOrbs } from '../landing/FloatingOrbs';

type PlayerMode = 'mini' | 'full';

interface GlassPlayerProps {
  mode?: PlayerMode;
  onExpand?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
}

export function GlassPlayer({
  mode = 'mini',
  onExpand,
  onMinimize,
  onClose,
}: GlassPlayerProps) {
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
  } = usePlayerStore(
    useShallow((state) => ({
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
    }))
  );

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  }, [currentTime, duration]);

  // Audio element handlers
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
      audio.play().catch((error) => console.error('[GlassPlayer] Playback failed:', error));
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      audio?.pause();
      return;
    }

    if (isPlaying) {
      audio.play().catch((error) => console.error('[GlassPlayer] Playback error:', error));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(Math.floor(audioRef.current.duration));
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  if (!currentTrack) {
    return null;
  }

  // Mini Player
  if (mode === 'mini') {
    return (
      <div className="glass-dark border-t border-white/10">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentTrack.coverImage && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                <img
                  src={currentTrack.coverImage}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm truncate">{currentTrack.title}</p>
              <p className="text-xs text-white/60 truncate">
                {currentTrack.artist || 'MindScript'}
              </p>
            </div>
          </div>

          {/* Mini Waveform */}
          <div className="hidden md:block flex-1 max-w-xs">
            <WaveformVisualizer isPlaying={isPlaying} progress={progress} barCount={24} />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous"
              onClick={playPrevious}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <SkipBackIcon className="h-4 w-4" />
            </button>

            <PlayButton
              isPlaying={isPlaying}
              onClick={togglePlayPause}
              size="sm"
              breathing
              glow
            />

            <button
              type="button"
              aria-label="Next"
              onClick={playNext}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <SkipForwardIcon className="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label={repeatMode === 'none' ? 'Enable repeat' : 'Disable repeat'}
              onClick={toggleRepeat}
              className={cn(
                'p-2 rounded-full transition-colors',
                repeatMode !== 'none' ? 'text-accent bg-accent/20' : 'text-white/60 hover:text-white'
              )}
            >
              <RepeatIcon className="h-4 w-4" />
            </button>

            <VolumeSlider
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              className="hidden md:flex"
            />

            {onExpand && (
              <button
                type="button"
                aria-label="Expand player"
                onClick={onExpand}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <Maximize2Icon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mini Progress Bar */}
        <div className="px-4 pb-2">
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            size="sm"
          />
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

  // Full Player (Modal)
  return (
    <div className="fixed inset-0 z-50 bg-deep-space overflow-hidden">
      <FloatingOrbs variant="vibrant" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4">
        {onMinimize && (
          <button
            type="button"
            aria-label="Minimize"
            onClick={onMinimize}
            className="p-2 rounded-full glass-dark hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <Minimize2Icon className="h-5 w-5" />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-full glass-dark hover:bg-white/10 text-white/80 hover:text-white transition-colors ml-auto"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 pb-24 -mt-16">
        {/* Album Art */}
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-2xl mb-8 glass">
          {currentTrack.coverImage ? (
            <img
              src={currentTrack.coverImage}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
              <span className="text-6xl">🎵</span>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {currentTrack.title}
          </h2>
          <p className="text-white/60">{currentTrack.artist || 'MindScript'}</p>
        </div>

        {/* Waveform */}
        <div className="w-full max-w-lg mb-6">
          <WaveformVisualizer isPlaying={isPlaying} progress={progress} barCount={60} />
        </div>

        {/* Progress */}
        <div className="w-full max-w-lg mb-8">
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            size="lg"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            aria-label="Toggle shuffle"
            onClick={toggleShuffle}
            className={cn(
              'p-3 rounded-full transition-colors',
              shuffleMode ? 'text-accent' : 'text-white/60 hover:text-white'
            )}
          >
            <ShuffleIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            aria-label="Previous"
            onClick={playPrevious}
            className="p-3 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <SkipBackIcon className="h-6 w-6" />
          </button>

          <PlayButton
            isPlaying={isPlaying}
            onClick={togglePlayPause}
            size="lg"
            breathing
            glow
          />

          <button
            type="button"
            aria-label="Next"
            onClick={playNext}
            className="p-3 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <SkipForwardIcon className="h-6 w-6" />
          </button>

          <button
            type="button"
            aria-label={repeatMode === 'none' ? 'Enable repeat' : 'Disable repeat'}
            onClick={toggleRepeat}
            className={cn(
              'p-3 rounded-full transition-colors',
              repeatMode !== 'none' ? 'text-accent bg-accent/20' : 'text-white/60 hover:text-white'
            )}
          >
            <RepeatIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Volume (centered below controls) */}
        <div className="mt-8">
          <VolumeSlider
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onToggleMute={toggleMute}
            showGlow
          />
        </div>
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

'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { Button } from '@mindscript/ui';
import { Spinner } from '@mindscript/ui';
import { 
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/solid';
import { 
  SpeakerWaveIcon as SpeakerWaveOutlineIcon,
} from '@heroicons/react/24/outline';

interface AudioPlayerProps {
  mode?: 'full' | 'mini';
  onExpand?: () => void;
}

export function AudioPlayer({ mode = 'full', onExpand }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLInputElement>(null);
  const volumeBarRef = useRef<HTMLInputElement>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    error,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    playNext,
    playPrevious,
    setCurrentTime,
    setDuration,
    setIsLoading,
    setError,
  } = usePlayerStore();

  // Format time from seconds to mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Get volume icon based on level
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <SpeakerXMarkIcon className="w-5 h-5" data-testid="volume-muted-icon" />;
    } else if (volume > 0.5) {
      return <SpeakerWaveIcon className="w-5 h-5" data-testid="volume-high-icon" />;
    } else if (volume > 0.2) {
      return <SpeakerWaveOutlineIcon className="w-5 h-5" data-testid="volume-medium-icon" />;
    } else {
      return <SpeakerWaveOutlineIcon className="w-5 h-5 opacity-60" data-testid="volume-low-icon" />;
    }
  };

  // Handle audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // Update audio source when track changes
    if (audio.src !== currentTrack.url) {
      setIsLoading(true);
      setIsAudioReady(false);
      audio.src = currentTrack.url;
      audio.load();
    }

    // Event handlers
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsAudioReady(true);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      playNext();
    };

    const handleError = (e: Event) => {
      const audioError = e.target as HTMLAudioElement;
      let errorMessage = 'Failed to load audio';
      
      if (audioError.error) {
        switch (audioError.error.code) {
          case 1:
            errorMessage = 'Audio loading aborted';
            break;
          case 2:
            errorMessage = 'Network error while loading audio';
            break;
          case 3:
            errorMessage = 'Audio decoding error';
            break;
          case 4:
            errorMessage = 'Audio format not supported';
            break;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
      setIsAudioReady(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setIsAudioReady(true);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);

    // Cleanup
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [currentTrack, setCurrentTime, setDuration, setError, setIsLoading, playNext]);

  // Sync play/pause state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isAudioReady) return;

    if (isPlaying) {
      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
        pause();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, isAudioReady, pause]);

  // Sync volume with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Sync seek position with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isAudioReady) return;

    // Only update if difference is significant (more than 1 second)
    if (Math.abs(audio.currentTime - currentTime) > 1) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isAudioReady]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, seek, currentTime, duration, setVolume, volume, toggleMute]);

  // Handle seek bar change
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseFloat(e.target.value) / 100;
    seek(duration * percentage);
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value) / 100;
    setVolume(newVolume);
  };

  // Mini player mode
  if (mode === 'mini') {
    return (
      <div 
        data-testid="mini-player"
        className="flex items-center gap-4 px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
      >
        {/* Cover image */}
        {currentTrack?.coverImage && (
          <img
            src={currentTrack.coverImage}
            alt={currentTrack.title}
            className="w-12 h-12 rounded object-cover"
          />
        )}

        {/* Track info */}
        <div className="flex-1 min-w-0">
          {currentTrack ? (
            <>
              <p className="text-sm font-medium truncate">{currentTrack.title}</p>
              {currentTrack.artist && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {currentTrack.artist}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">No track selected</p>
          )}
        </div>

        {/* Play/Pause button */}
        <button
          onClick={togglePlayPause}
          disabled={!currentTrack || isLoading}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <PauseIcon className="w-5 h-5" />
          ) : (
            <PlayIcon className="w-5 h-5" />
          )}
        </button>

        {/* Expand button */}
        {onExpand && (
          <button
            onClick={onExpand}
            aria-label="Expand player"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronUpIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Full player mode
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" />

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Track info section */}
      <div className="mb-6">
        {currentTrack ? (
          <div className="flex items-center gap-4">
            {currentTrack.coverImage && (
              <img
                src={currentTrack.coverImage}
                alt={currentTrack.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold truncate">{currentTrack.title}</h3>
              {currentTrack.artist && (
                <p className="text-gray-600 dark:text-gray-400 truncate">
                  {currentTrack.artist}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No track selected
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            ref={progressBarRef}
            type="range"
            min="0"
            max="100"
            value={progressPercentage}
            onChange={handleSeekChange}
            disabled={!currentTrack || isLoading}
            aria-label="Seek"
            className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progressPercentage}%, #e5e7eb ${progressPercentage}%, #e5e7eb 100%)`
            }}
          />
          <span className="text-xs text-gray-500 w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={playPrevious}
          disabled={!currentTrack || isLoading}
          aria-label="Previous track"
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <BackwardIcon className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlayPause}
          disabled={!currentTrack || isLoading}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div data-testid="loading-spinner">
              <Spinner className="w-6 h-6" />
            </div>
          ) : isPlaying ? (
            <PauseIcon className="w-6 h-6" />
          ) : (
            <PlayIcon className="w-6 h-6" />
          )}
        </button>

        <button
          onClick={playNext}
          disabled={!currentTrack || isLoading}
          aria-label="Next track"
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ForwardIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Volume controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {getVolumeIcon()}
        </button>
        <input
          ref={volumeBarRef}
          type="range"
          min="0"
          max="100"
          value={isMuted ? 0 : volume * 100}
          onChange={handleVolumeChange}
          aria-label="Volume"
          className="w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${isMuted ? 0 : volume * 100}%, #e5e7eb ${isMuted ? 0 : volume * 100}%, #e5e7eb 100%)`
          }}
        />
      </div>
    </div>
  );
}
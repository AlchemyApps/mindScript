'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { cn } from '@/lib/utils';

interface PreviewPlayerProps {
  audioUrl?: string;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  onError?: (error: Error) => void;
}

export function PreviewPlayer({
  audioUrl,
  isPlaying,
  onPlayStateChange,
  onError,
}: PreviewPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const previousVolumeRef = useRef(75);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    setIsLoading(true);
    setHasError(false);

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#cbd5e1',
      progressColor: '#3b82f6',
      cursorColor: '#1e40af',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 2,
      height: 64,
      barGap: 3,
      normalize: true,
      interact: true,
      dragToSeek: true,
    });

    wavesurfer.on('ready', () => {
      setIsLoading(false);
      setDuration(wavesurfer.getDuration());
    });

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('interaction', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('error', (error) => {
      setIsLoading(false);
      setHasError(true);
      onError?.(new Error(error));
    });

    wavesurfer.load(audioUrl);
    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, onError]);

  // Handle play state
  useEffect(() => {
    if (!wavesurferRef.current) return;

    if (isPlaying) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying]);

  // Handle volume
  useEffect(() => {
    if (!wavesurferRef.current) return;
    
    const actualVolume = isMuted ? 0 : volume / 100;
    wavesurferRef.current.setVolume(actualVolume);
  }, [volume, isMuted]);

  const handlePlayPause = useCallback(() => {
    onPlayStateChange(!isPlaying);
  }, [isPlaying, onPlayStateChange]);

  const handleVolumeChange = useCallback((values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const handleMuteToggle = useCallback(() => {
    if (isMuted) {
      setVolume(previousVolumeRef.current);
      setIsMuted(false);
    } else {
      previousVolumeRef.current = volume;
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!wavesurferRef.current) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const progress = x / rect.width;
    
    wavesurferRef.current.seekTo(progress);
    event.currentTarget.setAttribute('data-seek-position', progress.toString());
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!wavesurferRef.current) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        handlePlayPause();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        wavesurferRef.current.skip(-5);
        containerRef.current?.setAttribute('data-last-seek-action', 'backward');
        break;
      case 'ArrowRight':
        event.preventDefault();
        wavesurferRef.current.skip(5);
        containerRef.current?.setAttribute('data-last-seek-action', 'forward');
        break;
    }
  }, [handlePlayPause]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="flex flex-col space-y-4"
      data-testid="preview-player"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Waveform */}
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full"
          data-testid="waveform-container"
          data-audio-url={audioUrl}
          onError={() => setHasError(true)}
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading waveform...</span>
            </div>
          </div>
        )}
        
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">Failed to load audio</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar (fallback/additional) */}
      <div className="space-y-1">
        <div
          className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
          onClick={handleSeek}
          data-testid="progress-bar-clickable"
        >
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercentage)}
            aria-label="Playback progress"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-4" data-testid="player-controls">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={!audioUrl || isLoading || hasError}
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-full',
            'bg-primary text-white hover:bg-primary/90',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all'
          )}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </button>

        {/* Volume controls */}
        <div className="flex items-center space-x-2 flex-1">
          <button
            type="button"
            onClick={handleMuteToggle}
            className="text-gray-600 hover:text-gray-900 transition-colors"
            aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          
          <Slider.Root
            className="relative flex items-center select-none touch-none w-32 h-5"
            value={[volume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={100}
            step={1}
            aria-label="Volume"
          >
            <Slider.Track className="bg-gray-200 relative grow rounded-full h-1.5">
              <Slider.Range className="absolute bg-primary rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb
              className={cn(
                'block w-4 h-4 bg-white border-2 border-primary rounded-full',
                'hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
              )}
            />
          </Slider.Root>
        </div>
      </div>
    </div>
  );
}
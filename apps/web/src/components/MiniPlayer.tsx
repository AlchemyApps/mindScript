'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPlayer } from '@/components/player/GlassPlayer';
import { PIPPlayer } from '@/components/player/PIPPlayer';

export function MiniPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    currentTrack,
    isPlaying,
    playerMode,
    volume,
    isMuted,
    cyclePlayerMode,
    togglePlayPause,
    setCurrentTime,
    setDuration,
    playNext,
  } = usePlayerStore(
    useShallow((state) => ({
      currentTrack: state.currentTrack,
      isPlaying: state.isPlaying,
      playerMode: state.playerMode,
      volume: state.volume,
      isMuted: state.isMuted,
      cyclePlayerMode: state.cyclePlayerMode,
      togglePlayPause: state.togglePlayPause,
      setCurrentTime: state.setCurrentTime,
      setDuration: state.setDuration,
      playNext: state.playNext,
    }))
  );

  // Sync volume
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Load new track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.src = currentTrack.url;
    audio.load();

    if (isPlaying) {
      audio.play().catch((err) => console.error('[MiniPlayer] Playback failed:', err));
    }
  }, [currentTrack?.id]);

  // Play/pause sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      audio?.pause();
      return;
    }

    if (isPlaying) {
      audio.play().catch((err) => console.error('[MiniPlayer] Play error:', err));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.id]);

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

  if (!currentTrack) {
    return null;
  }

  return (
    <>
      {/* Persistent audio element — never unmounts while a track is loaded */}
      <audio
        ref={audioRef}
        hidden
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={playNext}
      />

      {playerMode === 'pip' && (
        <PIPPlayer
          isPlaying={isPlaying}
          onRestore={cyclePlayerMode}
          onTogglePlayPause={togglePlayPause}
        />
      )}

      {playerMode === 'full' && (
        <GlassPlayer
          mode="full"
          onCycleMode={cyclePlayerMode}
          onSeek={handleSeek}
        />
      )}

      {playerMode === 'bar' && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <GlassPlayer
            mode="mini"
            onCycleMode={cyclePlayerMode}
            onSeek={handleSeek}
          />
        </div>
      )}
    </>
  );
}

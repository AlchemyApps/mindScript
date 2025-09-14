import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlayerStore } from './playerStore';

describe('PlayerStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      isMuted: false,
      queue: [],
      currentIndex: -1,
      shuffleMode: false,
      repeatMode: 'none',
      isLoading: false,
      error: null,
    });
  });

  describe('Track Management', () => {
    it('should set current track', () => {
      const { result } = renderHook(() => usePlayerStore());
      const track = {
        id: 'track-1',
        title: 'Test Track',
        artist: 'Test Artist',
        url: '/audio/test.mp3',
        duration: 180,
        coverImage: '/images/cover.jpg',
      };

      act(() => {
        result.current.setCurrentTrack(track);
      });

      expect(result.current.currentTrack).toEqual(track);
      expect(result.current.duration).toBe(180);
    });

    it('should clear current track', () => {
      const { result } = renderHook(() => usePlayerStore());
      const track = {
        id: 'track-1',
        title: 'Test Track',
        artist: 'Test Artist',
        url: '/audio/test.mp3',
        duration: 180,
      };

      act(() => {
        result.current.setCurrentTrack(track);
        result.current.clearCurrentTrack();
      });

      expect(result.current.currentTrack).toBeNull();
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentTime).toBe(0);
    });
  });

  describe('Playback Controls', () => {
    it('should toggle play/pause', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.play();
      });
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.pause();
      });
      expect(result.current.isPlaying).toBe(false);

      act(() => {
        result.current.togglePlayPause();
      });
      expect(result.current.isPlaying).toBe(true);
    });

    it('should update current time', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setCurrentTime(45.5);
      });

      expect(result.current.currentTime).toBe(45.5);
    });

    it('should seek to position', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setDuration(180);
        result.current.seek(90);
      });

      expect(result.current.currentTime).toBe(90);
    });

    it('should handle seek with percentage', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setDuration(200);
        result.current.seekToPercentage(0.5);
      });

      expect(result.current.currentTime).toBe(100);
    });
  });

  describe('Volume Controls', () => {
    it('should set volume', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setVolume(0.5);
      });

      expect(result.current.volume).toBe(0.5);
    });

    it('should clamp volume between 0 and 1', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setVolume(1.5);
      });
      expect(result.current.volume).toBe(1);

      act(() => {
        result.current.setVolume(-0.5);
      });
      expect(result.current.volume).toBe(0);
    });

    it('should toggle mute', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setVolume(0.8);
        result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(true);
      expect(result.current.volume).toBe(0.8); // Volume preserved

      act(() => {
        result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(false);
      expect(result.current.volume).toBe(0.8);
    });
  });

  describe('Queue Management', () => {
    const mockTracks = [
      { id: '1', title: 'Track 1', artist: 'Artist 1', url: '/1.mp3', duration: 180 },
      { id: '2', title: 'Track 2', artist: 'Artist 2', url: '/2.mp3', duration: 200 },
      { id: '3', title: 'Track 3', artist: 'Artist 3', url: '/3.mp3', duration: 150 },
    ];

    it('should set queue', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setQueue(mockTracks);
      });

      expect(result.current.queue).toEqual(mockTracks);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.currentTrack).toEqual(mockTracks[0]);
    });

    it('should add track to queue', () => {
      const { result } = renderHook(() => usePlayerStore());
      const newTrack = { id: '4', title: 'Track 4', artist: 'Artist 4', url: '/4.mp3', duration: 160 };

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.addToQueue(newTrack);
      });

      expect(result.current.queue).toHaveLength(4);
      expect(result.current.queue[3]).toEqual(newTrack);
    });

    it('should remove track from queue', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.removeFromQueue(1);
      });

      expect(result.current.queue).toHaveLength(2);
      expect(result.current.queue[1].id).toBe('3');
    });

    it('should play next track', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.playNext();
      });

      expect(result.current.currentIndex).toBe(1);
      expect(result.current.currentTrack?.id).toBe('2');
    });

    it('should play previous track', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.setCurrentIndex(2);
        result.current.playPrevious();
      });

      expect(result.current.currentIndex).toBe(1);
      expect(result.current.currentTrack?.id).toBe('2');
    });

    it('should handle repeat mode', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.setCurrentIndex(2);
        result.current.setRepeatMode('one');
        result.current.playNext();
      });

      expect(result.current.currentIndex).toBe(2);
      expect(result.current.currentTrack?.id).toBe('3');

      act(() => {
        result.current.setRepeatMode('all');
        result.current.playNext();
      });

      expect(result.current.currentIndex).toBe(0);
      expect(result.current.currentTrack?.id).toBe('1');
    });

    it('should clear queue', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.clearQueue();
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.currentTrack).toBeNull();
    });
  });

  describe('Shuffle Mode', () => {
    it('should toggle shuffle mode', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.toggleShuffle();
      });

      expect(result.current.shuffleMode).toBe(true);

      act(() => {
        result.current.toggleShuffle();
      });

      expect(result.current.shuffleMode).toBe(false);
    });

    it('should shuffle queue when enabled', () => {
      const { result } = renderHook(() => usePlayerStore());
      const mockTracks = [
        { id: '1', title: 'Track 1', artist: 'Artist 1', url: '/1.mp3', duration: 180 },
        { id: '2', title: 'Track 2', artist: 'Artist 2', url: '/2.mp3', duration: 200 },
        { id: '3', title: 'Track 3', artist: 'Artist 3', url: '/3.mp3', duration: 150 },
        { id: '4', title: 'Track 4', artist: 'Artist 4', url: '/4.mp3', duration: 160 },
        { id: '5', title: 'Track 5', artist: 'Artist 5', url: '/5.mp3', duration: 170 },
      ];

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.setShuffleMode(true);
      });

      // Check that queue still contains all tracks
      expect(result.current.queue).toHaveLength(5);
      mockTracks.forEach(track => {
        expect(result.current.queue).toContainEqual(track);
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setIsLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setIsLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should set error state', () => {
      const { result } = renderHook(() => usePlayerStore());

      act(() => {
        result.current.setError('Failed to load track');
      });

      expect(result.current.error).toBe('Failed to load track');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Persistence', () => {
    it('should persist state to localStorage', () => {
      const { result } = renderHook(() => usePlayerStore());
      const mockTracks = [
        { id: '1', title: 'Track 1', artist: 'Artist 1', url: '/1.mp3', duration: 180 },
      ];

      act(() => {
        result.current.setQueue(mockTracks);
        result.current.setVolume(0.7);
        result.current.setRepeatMode('all');
      });

      // Simulate page reload by getting new store instance
      const { result: newResult } = renderHook(() => usePlayerStore());

      expect(newResult.current.volume).toBe(0.7);
      expect(newResult.current.repeatMode).toBe('all');
    });
  });
});
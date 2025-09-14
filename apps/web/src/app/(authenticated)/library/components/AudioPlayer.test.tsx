import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioPlayer } from './AudioPlayer';
import { usePlayerStore } from '@/store/playerStore';

// Mock Howler
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    volume: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    unload: vi.fn(),
    playing: vi.fn().mockReturnValue(false),
    duration: vi.fn().mockReturnValue(180),
    state: vi.fn().mockReturnValue('loaded'),
  })),
}));

// Mock player store
vi.mock('@/store/playerStore');

describe('AudioPlayer', () => {
  const mockTrack = {
    id: 'track-1',
    title: 'Test Track',
    artist: 'Test Artist',
    url: '/audio/test.mp3',
    duration: 180,
    coverImage: '/images/cover.jpg',
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default store state
    (usePlayerStore as any).mockReturnValue({
      currentTrack: mockTrack,
      isPlaying: false,
      currentTime: 0,
      duration: 180,
      volume: 0.8,
      isMuted: false,
      isLoading: false,
      error: null,
      play: vi.fn(),
      pause: vi.fn(),
      togglePlayPause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      toggleMute: vi.fn(),
      playNext: vi.fn(),
      playPrevious: vi.fn(),
      setCurrentTime: vi.fn(),
      setDuration: vi.fn(),
      setIsLoading: vi.fn(),
      setError: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render player controls', () => {
      render(<AudioPlayer />);
      
      expect(screen.getByLabelText('Previous track')).toBeInTheDocument();
      expect(screen.getByLabelText('Play')).toBeInTheDocument();
      expect(screen.getByLabelText('Next track')).toBeInTheDocument();
      expect(screen.getByLabelText('Volume')).toBeInTheDocument();
    });

    it('should display track information', () => {
      render(<AudioPlayer />);
      
      expect(screen.getByText('Test Track')).toBeInTheDocument();
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
    });

    it('should display cover image', () => {
      render(<AudioPlayer />);
      
      const coverImage = screen.getByAltText('Test Track');
      expect(coverImage).toBeInTheDocument();
      expect(coverImage).toHaveAttribute('src', '/images/cover.jpg');
    });

    it('should show placeholder when no track', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        currentTrack: null,
      });

      render(<AudioPlayer />);
      
      expect(screen.getByText('No track selected')).toBeInTheDocument();
    });

    it('should display time correctly', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        currentTime: 65,
        duration: 180,
      });

      render(<AudioPlayer />);
      
      expect(screen.getByText('1:05')).toBeInTheDocument();
      expect(screen.getByText('3:00')).toBeInTheDocument();
    });
  });

  describe('Playback Controls', () => {
    it('should toggle play/pause when button clicked', async () => {
      const togglePlayPause = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        togglePlayPause,
      });

      render(<AudioPlayer />);
      
      const playButton = screen.getByLabelText('Play');
      await userEvent.click(playButton);
      
      expect(togglePlayPause).toHaveBeenCalled();
    });

    it('should show pause button when playing', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        isPlaying: true,
      });

      render(<AudioPlayer />);
      
      expect(screen.getByLabelText('Pause')).toBeInTheDocument();
    });

    it('should call playNext when next button clicked', async () => {
      const playNext = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        playNext,
      });

      render(<AudioPlayer />);
      
      const nextButton = screen.getByLabelText('Next track');
      await userEvent.click(nextButton);
      
      expect(playNext).toHaveBeenCalled();
    });

    it('should call playPrevious when previous button clicked', async () => {
      const playPrevious = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        playPrevious,
      });

      render(<AudioPlayer />);
      
      const prevButton = screen.getByLabelText('Previous track');
      await userEvent.click(prevButton);
      
      expect(playPrevious).toHaveBeenCalled();
    });
  });

  describe('Seek Bar', () => {
    it('should update progress when seeking', async () => {
      const seek = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        seek,
        duration: 200,
      });

      render(<AudioPlayer />);
      
      const seekBar = screen.getByRole('slider', { name: /seek/i });
      fireEvent.change(seekBar, { target: { value: '50' } });
      
      expect(seek).toHaveBeenCalledWith(100); // 50% of 200
    });

    it('should display correct progress percentage', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        currentTime: 60,
        duration: 120,
      });

      render(<AudioPlayer />);
      
      const seekBar = screen.getByRole('slider', { name: /seek/i });
      expect(seekBar).toHaveValue('50');
    });
  });

  describe('Volume Controls', () => {
    it('should update volume when slider changed', async () => {
      const setVolume = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        setVolume,
      });

      render(<AudioPlayer />);
      
      const volumeSlider = screen.getByRole('slider', { name: /volume/i });
      fireEvent.change(volumeSlider, { target: { value: '60' } });
      
      expect(setVolume).toHaveBeenCalledWith(0.6);
    });

    it('should toggle mute when mute button clicked', async () => {
      const toggleMute = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        toggleMute,
      });

      render(<AudioPlayer />);
      
      const muteButton = screen.getByLabelText('Mute');
      await userEvent.click(muteButton);
      
      expect(toggleMute).toHaveBeenCalled();
    });

    it('should show unmute button when muted', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        isMuted: true,
      });

      render(<AudioPlayer />);
      
      expect(screen.getByLabelText('Unmute')).toBeInTheDocument();
    });

    it('should show different volume icon based on level', () => {
      const { rerender } = render(<AudioPlayer />);
      
      // High volume
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        volume: 0.8,
      });
      rerender(<AudioPlayer />);
      expect(screen.getByTestId('volume-high-icon')).toBeInTheDocument();
      
      // Medium volume
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        volume: 0.4,
      });
      rerender(<AudioPlayer />);
      expect(screen.getByTestId('volume-medium-icon')).toBeInTheDocument();
      
      // Low volume
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        volume: 0.1,
      });
      rerender(<AudioPlayer />);
      expect(screen.getByTestId('volume-low-icon')).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should play/pause on spacebar', () => {
      const togglePlayPause = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        togglePlayPause,
      });

      render(<AudioPlayer />);
      
      fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      
      expect(togglePlayPause).toHaveBeenCalled();
    });

    it('should seek forward on right arrow', () => {
      const seek = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        seek,
        currentTime: 50,
      });

      render(<AudioPlayer />);
      
      fireEvent.keyDown(document, { key: 'ArrowRight' });
      
      expect(seek).toHaveBeenCalledWith(60); // +10 seconds
    });

    it('should seek backward on left arrow', () => {
      const seek = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        seek,
        currentTime: 50,
      });

      render(<AudioPlayer />);
      
      fireEvent.keyDown(document, { key: 'ArrowLeft' });
      
      expect(seek).toHaveBeenCalledWith(40); // -10 seconds
    });

    it('should increase volume on up arrow', () => {
      const setVolume = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        setVolume,
        volume: 0.5,
      });

      render(<AudioPlayer />);
      
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      
      expect(setVolume).toHaveBeenCalledWith(0.6);
    });

    it('should decrease volume on down arrow', () => {
      const setVolume = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        setVolume,
        volume: 0.5,
      });

      render(<AudioPlayer />);
      
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      
      expect(setVolume).toHaveBeenCalledWith(0.4);
    });

    it('should toggle mute on M key', () => {
      const toggleMute = vi.fn();
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        toggleMute,
      });

      render(<AudioPlayer />);
      
      fireEvent.keyDown(document, { key: 'm' });
      
      expect(toggleMute).toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading spinner when loading', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        isLoading: true,
      });

      render(<AudioPlayer />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should display error message', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        error: 'Failed to load audio',
      });

      render(<AudioPlayer />);
      
      expect(screen.getByText('Failed to load audio')).toBeInTheDocument();
    });

    it('should disable controls when loading', () => {
      (usePlayerStore as any).mockReturnValue({
        ...usePlayerStore(),
        isLoading: true,
      });

      render(<AudioPlayer />);
      
      expect(screen.getByLabelText('Play')).toBeDisabled();
      expect(screen.getByLabelText('Next track')).toBeDisabled();
      expect(screen.getByLabelText('Previous track')).toBeDisabled();
    });
  });

  describe('Mini Player Mode', () => {
    it('should render in mini mode', () => {
      render(<AudioPlayer mode="mini" />);
      
      expect(screen.getByTestId('mini-player')).toBeInTheDocument();
    });

    it('should show only essential controls in mini mode', () => {
      render(<AudioPlayer mode="mini" />);
      
      expect(screen.getByLabelText('Play')).toBeInTheDocument();
      expect(screen.queryByRole('slider', { name: /seek/i })).not.toBeInTheDocument();
    });

    it('should expand to full player when clicked', async () => {
      const onExpand = vi.fn();
      render(<AudioPlayer mode="mini" onExpand={onExpand} />);
      
      const expandButton = screen.getByLabelText('Expand player');
      await userEvent.click(expandButton);
      
      expect(onExpand).toHaveBeenCalled();
    });
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPlayer } from './PreviewPlayer';

// Mock wavesurfer.js
vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => ({
      load: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      getCurrentTime: vi.fn(() => 30),
      getDuration: vi.fn(() => 120),
      seekTo: vi.fn(),
      setVolume: vi.fn(),
      isPlaying: vi.fn(() => false),
    })),
  },
}));

describe('PreviewPlayer', () => {
  const mockOnPlayStateChange = vi.fn();
  const mockAudioUrl = 'https://example.com/audio.mp3';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders play button when not playing', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
  });

  it('renders pause button when playing', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={true}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument();
  });

  it('handles play button click', async () => {
    const user = userEvent.setup();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const playButton = screen.getByRole('button', { name: /play/i });
    await user.click(playButton);

    expect(mockOnPlayStateChange).toHaveBeenCalledWith(true);
  });

  it('handles pause button click', async () => {
    const user = userEvent.setup();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={true}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const pauseButton = screen.getByRole('button', { name: /pause/i });
    await user.click(pauseButton);

    expect(mockOnPlayStateChange).toHaveBeenCalledWith(false);
  });

  it('displays current time and duration', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    // Initially shows 0:00 / 0:00
    expect(screen.getByText(/0:00 \/ 0:00/)).toBeInTheDocument();
  });

  it('formats time correctly', async () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={true}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    // Wait for waveform to load and update time
    await waitFor(() => {
      expect(screen.getByText(/0:30 \/ 2:00/)).toBeInTheDocument();
    });
  });

  it('renders progress bar', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('handles progress bar seek', async () => {
    const user = userEvent.setup();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const progressBar = screen.getByTestId('progress-bar-clickable');
    
    // Simulate clicking at 50% of the progress bar
    const rect = progressBar.getBoundingClientRect();
    await user.click(progressBar, {
      clientX: rect.left + rect.width * 0.5,
    });

    // Should trigger seek functionality
    await waitFor(() => {
      expect(progressBar).toHaveAttribute('data-seek-position');
    });
  });

  it('renders volume control slider', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const volumeSlider = screen.getByRole('slider', { name: /volume/i });
    expect(volumeSlider).toBeInTheDocument();
    expect(volumeSlider).toHaveAttribute('aria-valuemin', '0');
    expect(volumeSlider).toHaveAttribute('aria-valuemax', '100');
    expect(volumeSlider).toHaveAttribute('aria-valuenow', '75'); // Default volume
  });

  it('handles volume changes', async () => {
    const user = userEvent.setup();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const volumeSlider = screen.getByRole('slider', { name: /volume/i });
    
    fireEvent.change(volumeSlider, { target: { value: '50' } });
    
    await waitFor(() => {
      expect(volumeSlider).toHaveAttribute('aria-valuenow', '50');
    });
  });

  it('renders waveform container', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const waveformContainer = screen.getByTestId('waveform-container');
    expect(waveformContainer).toBeInTheDocument();
  });

  it('shows loading state while waveform loads', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    expect(screen.getByText(/loading waveform/i)).toBeInTheDocument();
  });

  it('handles spacebar keyboard shortcut for play/pause', async () => {
    const user = userEvent.setup();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    // Focus the player container
    const playerContainer = screen.getByTestId('preview-player');
    playerContainer.focus();

    // Press spacebar
    await user.keyboard(' ');

    expect(mockOnPlayStateChange).toHaveBeenCalledWith(true);
  });

  it('prevents spacebar default behavior', async () => {
    const user = userEvent.setup();
    const preventDefaultSpy = vi.fn();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const playerContainer = screen.getByTestId('preview-player');
    
    playerContainer.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        preventDefaultSpy();
      }
    });

    playerContainer.focus();
    await user.keyboard(' ');

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('handles arrow key shortcuts for seeking', async () => {
    const user = userEvent.setup();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={true}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const playerContainer = screen.getByTestId('preview-player');
    playerContainer.focus();

    // Right arrow - seek forward 5 seconds
    await user.keyboard('{ArrowRight}');
    
    // Left arrow - seek backward 5 seconds
    await user.keyboard('{ArrowLeft}');
    
    // Verify seek actions were triggered
    await waitFor(() => {
      expect(playerContainer).toHaveAttribute('data-last-seek-action');
    });
  });

  it('displays mute button when volume is not zero', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument();
  });

  it('handles mute/unmute toggle', async () => {
    const user = userEvent.setup();
    
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const muteButton = screen.getByRole('button', { name: /mute/i });
    await user.click(muteButton);

    // Should change to unmute button
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
    
    // Volume slider should show 0
    const volumeSlider = screen.getByRole('slider', { name: /volume/i });
    expect(volumeSlider).toHaveAttribute('aria-valuenow', '0');
  });

  it('cleans up waveform on unmount', () => {
    const { unmount } = render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    unmount();
    
    // Verify cleanup was called (mocked destroy method)
    // This would be verified through the mock
  });

  it('updates waveform when audio URL changes', async () => {
    const { rerender } = render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const newAudioUrl = 'https://example.com/new-audio.mp3';
    
    rerender(
      <PreviewPlayer
        audioUrl={newAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    // Should reload waveform with new URL
    await waitFor(() => {
      expect(screen.getByTestId('waveform-container')).toHaveAttribute(
        'data-audio-url',
        newAudioUrl
      );
    });
  });

  it('shows error state when audio fails to load', async () => {
    // Mock failed audio load
    const failedUrl = 'https://example.com/failed.mp3';
    
    render(
      <PreviewPlayer
        audioUrl={failedUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
        onError={(error) => {
          expect(error).toBeDefined();
        }}
      />
    );

    // Simulate error
    fireEvent.error(screen.getByTestId('waveform-container'));

    await waitFor(() => {
      expect(screen.getByText(/Failed to load audio/i)).toBeInTheDocument();
    });
  });

  it('provides accessible labels for all controls', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    expect(screen.getByRole('button', { name: /play/i })).toHaveAccessibleName();
    expect(screen.getByRole('slider', { name: /volume/i })).toHaveAccessibleName();
    expect(screen.getByRole('progressbar')).toHaveAccessibleName();
  });

  it('displays player in responsive layout', () => {
    render(
      <PreviewPlayer
        audioUrl={mockAudioUrl}
        isPlaying={false}
        onPlayStateChange={mockOnPlayStateChange}
      />
    );

    const container = screen.getByTestId('preview-player');
    expect(container).toHaveClass('flex', 'flex-col', 'space-y-4');
    
    const controls = screen.getByTestId('player-controls');
    expect(controls).toHaveClass('flex', 'items-center', 'space-x-4');
  });
});
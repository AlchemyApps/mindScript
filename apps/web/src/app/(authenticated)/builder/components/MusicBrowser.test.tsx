import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MusicBrowser } from './MusicBrowser';

const mockTracks = [
  {
    id: 'track-1',
    title: 'Ocean Waves',
    category: 'Nature',
    tags: ['relaxing', 'water', 'ambient'],
    duration: 180,
    preview_url: '/audio/ocean-waves-preview.mp3',
    waveform_url: '/images/ocean-waves-waveform.png',
  },
  {
    id: 'track-2',
    title: 'Forest Birds',
    category: 'Nature',
    tags: ['birds', 'forest', 'morning'],
    duration: 240,
    preview_url: '/audio/forest-birds-preview.mp3',
    waveform_url: '/images/forest-birds-waveform.png',
  },
  {
    id: 'track-3',
    title: 'Piano Meditation',
    category: 'Classical',
    tags: ['piano', 'peaceful', 'meditation'],
    duration: 300,
    preview_url: '/audio/piano-meditation-preview.mp3',
    waveform_url: '/images/piano-meditation-waveform.png',
  },
  {
    id: 'track-4',
    title: 'Tibetan Bowls',
    category: 'Ambient',
    tags: ['tibetan', 'bowls', 'healing'],
    duration: 360,
    preview_url: '/audio/tibetan-bowls-preview.mp3',
    waveform_url: '/images/tibetan-bowls-waveform.png',
  },
];

describe('MusicBrowser', () => {
  const mockOnSelect = vi.fn();
  const mockOnVolumeChange = vi.fn();
  
  const defaultProps = {
    selectedTrackId: undefined as string | undefined,
    volume: -10,
    onSelect: mockOnSelect,
    onVolumeChange: mockOnVolumeChange,
  };

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnVolumeChange.mockClear();
    // Mock fetch for tracks
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ tracks: mockTracks }),
    } as Response);
  });

  describe('Track Display', () => {
    it('renders track grid', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
        expect(screen.getByText('Forest Birds')).toBeInTheDocument();
        expect(screen.getByText('Piano Meditation')).toBeInTheDocument();
        expect(screen.getByText('Tibetan Bowls')).toBeInTheDocument();
      });
    });

    it('displays track metadata', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        // Categories
        expect(screen.getByText('Nature')).toBeInTheDocument();
        expect(screen.getByText('Classical')).toBeInTheDocument();
        expect(screen.getByText('Ambient')).toBeInTheDocument();
        
        // Duration
        expect(screen.getByText('3:00')).toBeInTheDocument(); // 180 seconds
        expect(screen.getByText('5:00')).toBeInTheDocument(); // 300 seconds
      });
    });

    it('shows loading state while fetching', () => {
      render(<MusicBrowser {...defaultProps} />);
      
      expect(screen.getByText(/loading music/i)).toBeInTheDocument();
    });

    it('highlights selected track', async () => {
      render(<MusicBrowser {...defaultProps} selectedTrackId="track-2" />);
      
      await waitFor(() => {
        const selectedCard = screen.getByText('Forest Birds').closest('[data-track-card]');
        expect(selectedCard).toHaveClass('ring-2');
      });
    });

    it('shows "No music" option', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /no music/i })).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter', () => {
    it('renders search input', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search tracks/i)).toBeInTheDocument();
      });
    });

    it('filters tracks by search term', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/search tracks/i);
      await user.type(searchInput, 'piano');
      
      await waitFor(() => {
        expect(screen.getByText('Piano Meditation')).toBeInTheDocument();
        expect(screen.queryByText('Ocean Waves')).not.toBeInTheDocument();
      });
    });

    it('filters tracks by category', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      await user.selectOptions(categoryFilter, 'Classical');
      
      await waitFor(() => {
        expect(screen.getByText('Piano Meditation')).toBeInTheDocument();
        expect(screen.queryByText('Ocean Waves')).not.toBeInTheDocument();
      });
    });

    it('filters tracks by tags', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const tagButton = screen.getByRole('button', { name: /meditation/i });
      await user.click(tagButton);
      
      await waitFor(() => {
        expect(screen.getByText('Piano Meditation')).toBeInTheDocument();
        expect(screen.queryByText('Ocean Waves')).not.toBeInTheDocument();
      });
    });

    it('shows all categories in filter dropdown', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        const categoryFilter = screen.getByRole('combobox', { name: /category/i });
        expect(categoryFilter).toBeInTheDocument();
      });
      
      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      await user.click(categoryFilter);
      
      expect(screen.getByRole('option', { name: 'All Categories' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Nature' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Classical' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ambient' })).toBeInTheDocument();
    });

    it('clears filters', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      // Apply filter
      const searchInput = screen.getByPlaceholderText(/search tracks/i);
      await user.type(searchInput, 'piano');
      
      await waitFor(() => {
        expect(screen.queryByText('Ocean Waves')).not.toBeInTheDocument();
      });
      
      // Clear filter
      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
    });
  });

  describe('Volume Control', () => {
    it('renders volume slider', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        const volumeSlider = screen.getByRole('slider', { name: /volume/i });
        expect(volumeSlider).toBeInTheDocument();
        expect(volumeSlider).toHaveAttribute('min', '-20');
        expect(volumeSlider).toHaveAttribute('max', '0');
      });
    });

    it('displays current volume in dB', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('-10 dB')).toBeInTheDocument();
      });
    });

    it('updates volume when slider changed', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('slider', { name: /volume/i })).toBeInTheDocument();
      });
      
      const volumeSlider = screen.getByRole('slider', { name: /volume/i });
      await user.clear(volumeSlider);
      await user.type(volumeSlider, '-5');
      
      await waitFor(() => {
        expect(mockOnVolumeChange).toHaveBeenCalledWith(-5);
      });
    });

    it('has mute button', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument();
      });
      
      const muteButton = screen.getByRole('button', { name: /mute/i });
      await user.click(muteButton);
      
      expect(mockOnVolumeChange).toHaveBeenCalledWith(-Infinity);
    });
  });

  describe('Preview Player', () => {
    it('shows play button for each track', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        const playButtons = screen.getAllByRole('button', { name: /play/i });
        expect(playButtons).toHaveLength(mockTracks.length);
      });
    });

    it('plays preview when play button clicked', async () => {
      const user = userEvent.setup();
      const mockPlay = vi.fn();
      
      // Mock Audio
      global.Audio = vi.fn().mockImplementation(() => ({
        play: mockPlay,
        pause: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const playButtons = screen.getAllByRole('button', { name: /play/i });
      await user.click(playButtons[0]);
      
      expect(mockPlay).toHaveBeenCalled();
    });

    it('shows pause button when track is playing', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const playButton = screen.getAllByRole('button', { name: /play/i })[0];
      await user.click(playButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
      });
    });

    it('displays waveform visualization', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        const waveforms = screen.getAllByAltText(/waveform/i);
        expect(waveforms).toHaveLength(mockTracks.length);
      });
    });

    it('shows progress bar during playback', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const playButton = screen.getAllByRole('button', { name: /play/i })[0];
      await user.click(playButton);
      
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });
  });

  describe('Track Selection', () => {
    it('selects track when clicked', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const trackCard = screen.getByText('Ocean Waves').closest('[data-track-card]')!;
      await user.click(trackCard);
      
      expect(mockOnSelect).toHaveBeenCalledWith('track-1');
    });

    it('deselects track when "No music" clicked', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} selectedTrackId="track-1" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /no music/i })).toBeInTheDocument();
      });
      
      const noMusicButton = screen.getByRole('button', { name: /no music/i });
      await user.click(noMusicButton);
      
      expect(mockOnSelect).toHaveBeenCalledWith(undefined);
    });

    it('shows checkmark on selected track', async () => {
      render(<MusicBrowser {...defaultProps} selectedTrackId="track-2" />);
      
      await waitFor(() => {
        const selectedCard = screen.getByText('Forest Birds').closest('[data-track-card]');
        expect(selectedCard?.querySelector('[data-testid="check-icon"]')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('search')).toHaveAttribute('aria-label', 'Search music tracks');
        expect(screen.getByRole('slider', { name: /volume/i })).toHaveAttribute('aria-valuetext', '-10 decibels');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      // Tab through tracks
      await user.tab();
      expect(screen.getByPlaceholderText(/search tracks/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('combobox', { name: /category/i })).toHaveFocus();
    });

    it('announces track selection to screen readers', async () => {
      const user = userEvent.setup();
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const trackCard = screen.getByText('Ocean Waves').closest('[data-track-card]')!;
      expect(trackCard).toHaveAttribute('role', 'button');
      expect(trackCard).toHaveAttribute('aria-pressed', 'false');
      
      await user.click(trackCard);
      
      // Would be aria-pressed="true" after selection if re-rendered with selectedTrackId
    });
  });

  describe('Error Handling', () => {
    it('shows error message if tracks fail to load', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load music/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('retries loading when retry button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tracks: mockTracks }),
        } as Response);
      
      render(<MusicBrowser {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayerVisualizer } from './LayerVisualizer';

describe('LayerVisualizer', () => {
  const mockOnToggle = vi.fn();
  
  const defaultLayers = {
    voice: { enabled: true, gain: -1 },
    music: { enabled: true, gain: -10 },
    solfeggio: { enabled: false, gain: -16 },
    binaural: { enabled: false, gain: -18 },
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all audio layers', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText('Voice')).toBeInTheDocument();
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Solfeggio')).toBeInTheDocument();
    expect(screen.getByText('Binaural')).toBeInTheDocument();
  });

  it('shows active state for enabled layers', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    const musicLayer = screen.getByTestId('layer-music');
    const solfeggioLayer = screen.getByTestId('layer-solfeggio');
    const binauralLayer = screen.getByTestId('layer-binaural');

    expect(voiceLayer).toHaveClass('bg-primary');
    expect(musicLayer).toHaveClass('bg-primary');
    expect(solfeggioLayer).toHaveClass('bg-gray-300');
    expect(binauralLayer).toHaveClass('bg-gray-300');
  });

  it('displays gain levels for each layer', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText('-1 dB')).toBeInTheDocument();
    expect(screen.getByText('-10 dB')).toBeInTheDocument();
    expect(screen.getByText('-16 dB')).toBeInTheDocument();
    expect(screen.getByText('-18 dB')).toBeInTheDocument();
  });

  it('handles layer toggle on click', async () => {
    const user = userEvent.setup();
    
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const solfeggioLayer = screen.getByTestId('layer-solfeggio');
    await user.click(solfeggioLayer);

    expect(mockOnToggle).toHaveBeenCalledWith('solfeggio', true);
  });

  it('toggles enabled layer to disabled', async () => {
    const user = userEvent.setup();
    
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    await user.click(voiceLayer);

    expect(mockOnToggle).toHaveBeenCalledWith('voice', false);
  });

  it('uses color coding for different layers', () => {
    render(
      <LayerVisualizer
        layers={{
          voice: { enabled: true, gain: -1 },
          music: { enabled: true, gain: -10 },
          solfeggio: { enabled: true, gain: -16 },
          binaural: { enabled: true, gain: -18 },
        }}
        onToggle={mockOnToggle}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    const musicLayer = screen.getByTestId('layer-music');
    const solfeggioLayer = screen.getByTestId('layer-solfeggio');
    const binauralLayer = screen.getByTestId('layer-binaural');

    expect(voiceLayer).toHaveAttribute('data-color', 'blue');
    expect(musicLayer).toHaveAttribute('data-color', 'green');
    expect(solfeggioLayer).toHaveAttribute('data-color', 'purple');
    expect(binauralLayer).toHaveAttribute('data-color', 'orange');
  });

  it('shows animation when layer is active', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
        isPlaying={true}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    const musicLayer = screen.getByTestId('layer-music');

    expect(voiceLayer.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(musicLayer.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows no animation when not playing', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
        isPlaying={false}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    expect(voiceLayer.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('displays layer icons', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByTestId('icon-voice')).toBeInTheDocument();
    expect(screen.getByTestId('icon-music')).toBeInTheDocument();
    expect(screen.getByTestId('icon-solfeggio')).toBeInTheDocument();
    expect(screen.getByTestId('icon-binaural')).toBeInTheDocument();
  });

  it('shows gain meter visualization', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const voiceMeter = screen.getByTestId('gain-meter-voice');
    const musicMeter = screen.getByTestId('gain-meter-music');

    // Gain meters should reflect the gain levels
    expect(voiceMeter).toHaveStyle({ width: expect.stringContaining('%') });
    expect(musicMeter).toHaveStyle({ width: expect.stringContaining('%') });
  });

  it('handles hover effects', async () => {
    const user = userEvent.setup();
    
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    
    await user.hover(voiceLayer);
    expect(voiceLayer).toHaveClass('hover:scale-105');
    
    await user.unhover(voiceLayer);
    expect(voiceLayer).not.toHaveClass('hover:scale-105-active');
  });

  it('shows tooltips with layer descriptions', async () => {
    const user = userEvent.setup();
    
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const voiceInfo = screen.getByTestId('info-voice');
    await user.hover(voiceInfo);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        /Main voice narration layer/i
      );
    });
  });

  it('indicates when layers are muted', () => {
    render(
      <LayerVisualizer
        layers={{
          voice: { enabled: true, gain: -60 }, // Effectively muted
          music: { enabled: true, gain: -10 },
          solfeggio: { enabled: false, gain: -16 },
          binaural: { enabled: false, gain: -18 },
        }}
        onToggle={mockOnToggle}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    expect(voiceLayer).toHaveClass('opacity-50');
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    // Tab to first layer
    await user.tab();
    const voiceLayer = screen.getByTestId('layer-voice');
    expect(voiceLayer).toHaveFocus();

    // Navigate with arrow keys
    await user.keyboard('{ArrowRight}');
    const musicLayer = screen.getByTestId('layer-music');
    expect(musicLayer).toHaveFocus();

    // Toggle with Space
    await user.keyboard(' ');
    expect(mockOnToggle).toHaveBeenCalledWith('music', false);
  });

  it('displays warning for conflicting layers', () => {
    render(
      <LayerVisualizer
        layers={{
          voice: { enabled: false, gain: -1 },
          music: { enabled: true, gain: -10 }, // Music without voice shows warning
          solfeggio: { enabled: false, gain: -16 },
          binaural: { enabled: false, gain: -18 },
        }}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText(/Music requires voice layer/i)).toBeInTheDocument();
  });

  it('shows layer dependency indicators', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const musicLayer = screen.getByTestId('layer-music');
    expect(musicLayer).toHaveAttribute('data-requires', 'voice');
  });

  it('animates layer state changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const solfeggioLayer = screen.getByTestId('layer-solfeggio');
    await user.click(solfeggioLayer);

    // Rerender with updated state
    rerender(
      <LayerVisualizer
        layers={{
          ...defaultLayers,
          solfeggio: { enabled: true, gain: -16 },
        }}
        onToggle={mockOnToggle}
      />
    );

    expect(solfeggioLayer).toHaveClass('transition-all');
  });

  it('displays layers in responsive layout', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const container = screen.getByTestId('layers-container');
    expect(container).toHaveClass('flex', 'flex-wrap', 'gap-4', 'justify-center');
  });

  it('shows combined gain indicator', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
        masterGain={3}
      />
    );

    // Should show effective gain (layer gain + master gain)
    const voiceLayer = screen.getByTestId('layer-voice');
    expect(voiceLayer).toHaveAttribute('title', expect.stringContaining('Effective: 2 dB'));
  });

  it('indicates clipping risk for high gains', () => {
    render(
      <LayerVisualizer
        layers={{
          voice: { enabled: true, gain: 8 },
          music: { enabled: true, gain: -2 },
          solfeggio: { enabled: true, gain: -5 },
          binaural: { enabled: true, gain: -5 },
        }}
        onToggle={mockOnToggle}
        masterGain={5}
      />
    );

    expect(screen.getByTestId('clipping-warning')).toBeInTheDocument();
    expect(screen.getByText(/Risk of audio clipping/i)).toBeInTheDocument();
  });

  it('provides accessible labels for screen readers', () => {
    render(
      <LayerVisualizer
        layers={defaultLayers}
        onToggle={mockOnToggle}
      />
    );

    const voiceLayer = screen.getByTestId('layer-voice');
    expect(voiceLayer).toHaveAttribute('role', 'button');
    expect(voiceLayer).toHaveAttribute('aria-label', expect.stringContaining('Voice layer'));
    expect(voiceLayer).toHaveAttribute('aria-pressed', 'true');
  });
});
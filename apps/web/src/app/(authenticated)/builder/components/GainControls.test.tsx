import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GainControls } from './GainControls';
import { DEFAULT_GAINS } from '@mindscript/audio-engine/constants';

describe('GainControls', () => {
  const mockOnChange = vi.fn();
  
  const defaultGains = {
    master: 0,
    voice: DEFAULT_GAINS.VOICE,
    music: DEFAULT_GAINS.MUSIC,
    solfeggio: DEFAULT_GAINS.SOLFEGGIO,
    binaural: DEFAULT_GAINS.BINAURAL,
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all gain sliders with correct labels', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText(/master gain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/voice gain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/music gain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/solfeggio gain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/binaural gain/i)).toBeInTheDocument();
  });

  it('displays correct gain ranges for each slider', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const masterSlider = screen.getByRole('slider', { name: /master gain/i });
    expect(masterSlider).toHaveAttribute('aria-valuemin', '-20');
    expect(masterSlider).toHaveAttribute('aria-valuemax', '6');

    const voiceSlider = screen.getByRole('slider', { name: /voice gain/i });
    expect(voiceSlider).toHaveAttribute('aria-valuemin', '-10');
    expect(voiceSlider).toHaveAttribute('aria-valuemax', '10');

    const musicSlider = screen.getByRole('slider', { name: /music gain/i });
    expect(musicSlider).toHaveAttribute('aria-valuemin', '-20');
    expect(musicSlider).toHaveAttribute('aria-valuemax', '0');

    const solfeggioSlider = screen.getByRole('slider', { name: /solfeggio gain/i });
    expect(solfeggioSlider).toHaveAttribute('aria-valuemin', '-30');
    expect(solfeggioSlider).toHaveAttribute('aria-valuemax', '0');

    const binauralSlider = screen.getByRole('slider', { name: /binaural gain/i });
    expect(binauralSlider).toHaveAttribute('aria-valuemin', '-30');
    expect(binauralSlider).toHaveAttribute('aria-valuemax', '0');
  });

  it('displays current gain values', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('0 dB')).toBeInTheDocument(); // Master
    expect(screen.getByText('-1 dB')).toBeInTheDocument(); // Voice
    expect(screen.getByText('-10 dB')).toBeInTheDocument(); // Music
    expect(screen.getByText('-16 dB')).toBeInTheDocument(); // Solfeggio
    expect(screen.getByText('-18 dB')).toBeInTheDocument(); // Binaural
  });

  it('handles master gain changes with debouncing', async () => {
    vi.useFakeTimers();
    
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const masterSlider = screen.getByRole('slider', { name: /master gain/i });
    
    fireEvent.change(masterSlider, { target: { value: '3' } });
    
    // Should not call immediately
    expect(mockOnChange).not.toHaveBeenCalled();
    
    // Fast forward debounce timer
    vi.advanceTimersByTime(100);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultGains,
      master: 3,
    });
    
    vi.useRealTimers();
  });

  it('handles individual layer gain changes', async () => {
    vi.useFakeTimers();
    
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const voiceSlider = screen.getByRole('slider', { name: /voice gain/i });
    
    fireEvent.change(voiceSlider, { target: { value: '5' } });
    
    vi.advanceTimersByTime(100);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultGains,
      voice: 5,
    });
    
    vi.useRealTimers();
  });

  it('shows visual meters for each gain level', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const masterMeter = screen.getByTestId('gain-meter-master');
    const voiceMeter = screen.getByTestId('gain-meter-voice');
    const musicMeter = screen.getByTestId('gain-meter-music');
    const solfeggioMeter = screen.getByTestId('gain-meter-solfeggio');
    const binauralMeter = screen.getByTestId('gain-meter-binaural');

    expect(masterMeter).toBeInTheDocument();
    expect(voiceMeter).toBeInTheDocument();
    expect(musicMeter).toBeInTheDocument();
    expect(solfeggioMeter).toBeInTheDocument();
    expect(binauralMeter).toBeInTheDocument();
  });

  it('updates meter colors based on gain levels', () => {
    render(
      <GainControls
        gains={{
          master: 3, // High (yellow)
          voice: -8, // Low (green)
          music: -3, // Medium (green)
          solfeggio: 0, // High (yellow)
          binaural: -25, // Very low (green)
        }}
        onChange={mockOnChange}
      />
    );

    const masterMeter = screen.getByTestId('gain-meter-master');
    const voiceMeter = screen.getByTestId('gain-meter-voice');
    const solfeggioMeter = screen.getByTestId('gain-meter-solfeggio');
    const binauralMeter = screen.getByTestId('gain-meter-binaural');

    expect(masterMeter).toHaveClass('bg-yellow-500');
    expect(voiceMeter).toHaveClass('bg-green-500');
    expect(solfeggioMeter).toHaveClass('bg-yellow-500');
    expect(binauralMeter).toHaveClass('bg-green-500');
  });

  it('renders reset to defaults button', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
  });

  it('handles reset to defaults action', async () => {
    const user = userEvent.setup();
    
    render(
      <GainControls
        gains={{
          master: 3,
          voice: 8,
          music: -2,
          solfeggio: -5,
          binaural: -10,
        }}
        onChange={mockOnChange}
      />
    );

    const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
    await user.click(resetButton);

    expect(mockOnChange).toHaveBeenCalledWith({
      master: 0,
      voice: DEFAULT_GAINS.VOICE,
      music: DEFAULT_GAINS.MUSIC,
      solfeggio: DEFAULT_GAINS.SOLFEGGIO,
      binaural: DEFAULT_GAINS.BINAURAL,
    });
  });

  it('shows warning when master gain is too high', () => {
    render(
      <GainControls
        gains={{
          ...defaultGains,
          master: 5,
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Warning: High master gain may cause clipping/i)).toBeInTheDocument();
  });

  it('disables layer sliders based on active layers prop', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
        activeLayers={{
          voice: true,
          music: false,
          solfeggio: true,
          binaural: false,
        }}
      />
    );

    const voiceSlider = screen.getByRole('slider', { name: /voice gain/i });
    const musicSlider = screen.getByRole('slider', { name: /music gain/i });
    const solfeggioSlider = screen.getByRole('slider', { name: /solfeggio gain/i });
    const binauralSlider = screen.getByRole('slider', { name: /binaural gain/i });

    expect(voiceSlider).not.toBeDisabled();
    expect(musicSlider).toBeDisabled();
    expect(solfeggioSlider).not.toBeDisabled();
    expect(binauralSlider).toBeDisabled();
  });

  it('supports keyboard shortcuts for adjustments', async () => {
    const user = userEvent.setup();
    
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const masterSlider = screen.getByRole('slider', { name: /master gain/i });
    
    // Focus the slider
    masterSlider.focus();
    
    // Use arrow keys to adjust
    await user.keyboard('{ArrowUp}');
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultGains,
      master: 1,
    });
    
    await user.keyboard('{ArrowDown}');
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultGains,
      master: -1,
    });
  });

  it('shows tooltips explaining each gain control', async () => {
    const user = userEvent.setup();
    
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const masterInfo = screen.getByTestId('info-icon-master');
    await user.hover(masterInfo);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        /Controls the overall output level/i
      );
    });
  });

  it('handles rapid slider movements gracefully', async () => {
    vi.useFakeTimers();
    
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const masterSlider = screen.getByRole('slider', { name: /master gain/i });
    
    // Simulate rapid changes
    fireEvent.change(masterSlider, { target: { value: '1' } });
    fireEvent.change(masterSlider, { target: { value: '2' } });
    fireEvent.change(masterSlider, { target: { value: '3' } });
    
    // Should batch changes through debouncing
    vi.advanceTimersByTime(100);
    
    // Only the last value should be called
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultGains,
      master: 3,
    });
    
    vi.useRealTimers();
  });

  it('displays gain values with proper formatting', () => {
    render(
      <GainControls
        gains={{
          master: 0.5,
          voice: -1.5,
          music: -10.5,
          solfeggio: -16.5,
          binaural: -18.5,
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('0.5 dB')).toBeInTheDocument();
    expect(screen.getByText('-1.5 dB')).toBeInTheDocument();
    expect(screen.getByText('-10.5 dB')).toBeInTheDocument();
    expect(screen.getByText('-16.5 dB')).toBeInTheDocument();
    expect(screen.getByText('-18.5 dB')).toBeInTheDocument();
  });

  it('provides accessible labels for screen readers', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('group', { name: /gain controls/i })).toBeInTheDocument();
    
    const sliders = screen.getAllByRole('slider');
    sliders.forEach(slider => {
      expect(slider).toHaveAccessibleName();
      expect(slider).toHaveAccessibleDescription();
    });
  });

  it('displays controls in responsive layout', () => {
    render(
      <GainControls
        gains={defaultGains}
        onChange={mockOnChange}
      />
    );

    const container = screen.getByTestId('gain-controls-container');
    expect(container).toHaveClass('space-y-4', 'lg:space-y-6');
    
    const sliderGroups = screen.getAllByTestId(/slider-group/);
    sliderGroups.forEach(group => {
      expect(group).toHaveClass('flex', 'flex-col', 'space-y-2');
    });
  });
});
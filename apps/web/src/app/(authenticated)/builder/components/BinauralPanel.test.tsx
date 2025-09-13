import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BinauralPanel } from './BinauralPanel';
import { BINAURAL_BANDS } from '@mindscript/audio-engine/constants';

describe('BinauralPanel', () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all binaural bands with names and descriptions', () => {
    render(
      <BinauralPanel
        selectedBand={undefined}
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    // Check for all band cards
    Object.entries(BINAURAL_BANDS).forEach(([band, details]) => {
      expect(screen.getByText(details.name)).toBeInTheDocument();
      expect(screen.getByText(details.description)).toBeInTheDocument();
      expect(screen.getByText(`${details.range[0]}-${details.range[1]} Hz`)).toBeInTheDocument();
    });

    // Check for "None" option
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Disable binaural beats')).toBeInTheDocument();
  });

  it('shows selected band as active', () => {
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const selectedCard = screen.getByRole('radio', { name: /theta/i, checked: true });
    expect(selectedCard).toBeChecked();
  });

  it('handles band selection change', async () => {
    const user = userEvent.setup();
    render(
      <BinauralPanel
        selectedBand={undefined}
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const alphaCard = screen.getByRole('radio', { name: /alpha/i });
    await user.click(alphaCard);

    expect(mockOnChange).toHaveBeenCalledWith({
      band: 'alpha',
      carrierFrequency: 250,
      volume: -18,
    });
  });

  it('handles "None" selection to disable binaural', async () => {
    const user = userEvent.setup();
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const noneOption = screen.getByRole('radio', { name: /None/i });
    await user.click(noneOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      band: undefined,
      carrierFrequency: 250,
      volume: -18,
    });
  });

  it('renders carrier frequency slider with correct range', () => {
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /carrier frequency/i });
    expect(slider).toHaveAttribute('aria-valuemin', '200');
    expect(slider).toHaveAttribute('aria-valuemax', '500');
    expect(slider).toHaveAttribute('aria-valuenow', '250');
  });

  it('handles carrier frequency changes with debouncing', async () => {
    vi.useFakeTimers();
    
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /carrier frequency/i });
    
    // Simulate dragging slider
    fireEvent.change(slider, { target: { value: '350' } });
    
    // Should not call immediately
    expect(mockOnChange).not.toHaveBeenCalled();
    
    // Fast forward debounce timer
    vi.advanceTimersByTime(100);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      band: 'theta',
      carrierFrequency: 350,
      volume: -18,
    });
    
    vi.useRealTimers();
  });

  it('renders volume slider with correct range', () => {
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /volume/i });
    expect(slider).toHaveAttribute('aria-valuemin', '-30');
    expect(slider).toHaveAttribute('aria-valuemax', '0');
    expect(slider).toHaveAttribute('aria-valuenow', '-18');
  });

  it('handles volume changes with debouncing', async () => {
    vi.useFakeTimers();
    
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /volume/i });
    
    // Simulate dragging slider
    fireEvent.change(slider, { target: { value: '-12' } });
    
    // Should not call immediately
    expect(mockOnChange).not.toHaveBeenCalled();
    
    // Fast forward debounce timer
    vi.advanceTimersByTime(100);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      band: 'theta',
      carrierFrequency: 250,
      volume: -12,
    });
    
    vi.useRealTimers();
  });

  it('disables sliders when no band is selected', () => {
    render(
      <BinauralPanel
        selectedBand={undefined}
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const carrierSlider = screen.getByRole('slider', { name: /carrier frequency/i });
    const volumeSlider = screen.getByRole('slider', { name: /volume/i });
    
    expect(carrierSlider).toBeDisabled();
    expect(volumeSlider).toBeDisabled();
  });

  it('shows carrier frequency and volume values', () => {
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={350}
        volume={-12}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('350 Hz')).toBeInTheDocument();
    expect(screen.getByText('-12 dB')).toBeInTheDocument();
  });

  it('displays beat frequency calculation', () => {
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    // Theta band is 4-8 Hz, so it should show the middle value (6 Hz)
    expect(screen.getByText(/Beat frequency: 6 Hz/i)).toBeInTheDocument();
  });

  it('shows visual frequency range representation', () => {
    render(
      <BinauralPanel
        selectedBand="alpha"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const rangeBar = screen.getByTestId('frequency-range-bar');
    expect(rangeBar).toBeInTheDocument();
    expect(rangeBar).toHaveAttribute('data-band', 'alpha');
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <BinauralPanel
        selectedBand={undefined}
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    // Tab through band options
    await user.tab();
    const firstRadio = screen.getAllByRole('radio')[0];
    expect(firstRadio).toHaveFocus();

    // Use arrow keys to navigate
    await user.keyboard('{ArrowDown}');
    const secondRadio = screen.getAllByRole('radio')[1];
    expect(secondRadio).toHaveFocus();

    // Select with Space
    await user.keyboard(' ');
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('shows tooltips explaining binaural beats', async () => {
    const user = userEvent.setup();
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const infoIcon = screen.getByTestId('binaural-info-icon');
    await user.hover(infoIcon);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        /Binaural beats create a perceived frequency/i
      );
    });
  });

  it('handles rapid band changes gracefully', async () => {
    const user = userEvent.setup();
    render(
      <BinauralPanel
        selectedBand={undefined}
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    // Rapidly click different bands
    await user.click(screen.getByRole('radio', { name: /delta/i }));
    await user.click(screen.getByRole('radio', { name: /theta/i }));
    await user.click(screen.getByRole('radio', { name: /alpha/i }));

    // Should call onChange for each selection
    expect(mockOnChange).toHaveBeenCalledTimes(3);
    expect(mockOnChange).toHaveBeenLastCalledWith({
      band: 'alpha',
      carrierFrequency: 250,
      volume: -18,
    });
  });

  it('maintains settings when switching bands', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={350}
        volume={-10}
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole('radio', { name: /alpha/i }));

    expect(mockOnChange).toHaveBeenCalledWith({
      band: 'alpha',
      carrierFrequency: 350, // Carrier frequency maintained
      volume: -10, // Volume maintained
    });

    // Rerender with new props
    rerender(
      <BinauralPanel
        selectedBand="alpha"
        carrierFrequency={350}
        volume={-10}
        onChange={mockOnChange}
      />
    );

    const carrierSlider = screen.getByRole('slider', { name: /carrier frequency/i });
    const volumeSlider = screen.getByRole('slider', { name: /volume/i });
    
    expect(carrierSlider).toHaveAttribute('aria-valuenow', '350');
    expect(volumeSlider).toHaveAttribute('aria-valuenow', '-10');
  });

  it('provides accessible labels for screen readers', () => {
    render(
      <BinauralPanel
        selectedBand="theta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('group', { name: /binaural beat band/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/carrier frequency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/binaural volume/i)).toBeInTheDocument();
  });

  it('displays band cards in responsive grid layout', () => {
    render(
      <BinauralPanel
        selectedBand={undefined}
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const container = screen.getByTestId('band-grid');
    expect(container).toHaveClass('grid', 'grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-6');
  });

  it('animates band selection changes', async () => {
    const user = userEvent.setup();
    render(
      <BinauralPanel
        selectedBand="delta"
        carrierFrequency={250}
        volume={-18}
        onChange={mockOnChange}
      />
    );

    const thetaCard = screen.getByTestId('band-card-theta');
    
    await user.click(screen.getByRole('radio', { name: /theta/i }));
    
    // Check for animation classes
    expect(thetaCard).toHaveClass('transition-all');
  });
});
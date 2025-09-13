import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FrequencyPanel } from './FrequencyPanel';
import { SOLFEGGIO_FREQUENCIES } from '@mindscript/audio-engine/constants';

describe('FrequencyPanel', () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all solfeggio frequencies with names and descriptions', () => {
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    // Check for all frequency cards
    Object.entries(SOLFEGGIO_FREQUENCIES).forEach(([freq, details]) => {
      expect(screen.getByText(`${freq} Hz`)).toBeInTheDocument();
      expect(screen.getByText(details.name)).toBeInTheDocument();
      expect(screen.getByText(details.description)).toBeInTheDocument();
    });

    // Check for "None" option
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Disable Solfeggio frequency')).toBeInTheDocument();
  });

  it('shows selected frequency as active', () => {
    render(
      <FrequencyPanel
        selectedFrequency={528}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const selectedCard = screen.getByRole('radio', { name: /528 Hz/i, checked: true });
    expect(selectedCard).toBeChecked();
  });

  it('handles frequency selection change', async () => {
    const user = userEvent.setup();
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const freq396Card = screen.getByRole('radio', { name: /396 Hz/i });
    await user.click(freq396Card);

    expect(mockOnChange).toHaveBeenCalledWith({
      frequency: 396,
      volume: -16,
    });
  });

  it('handles "None" selection to disable frequency', async () => {
    const user = userEvent.setup();
    render(
      <FrequencyPanel
        selectedFrequency={528}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const noneOption = screen.getByRole('radio', { name: /None/i });
    await user.click(noneOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      frequency: undefined,
      volume: -16,
    });
  });

  it('renders volume slider with correct range', () => {
    render(
      <FrequencyPanel
        selectedFrequency={528}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /volume/i });
    expect(slider).toHaveAttribute('aria-valuemin', '-30');
    expect(slider).toHaveAttribute('aria-valuemax', '0');
    expect(slider).toHaveAttribute('aria-valuenow', '-16');
  });

  it('handles volume slider changes with debouncing', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    
    render(
      <FrequencyPanel
        selectedFrequency={528}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /volume/i });
    
    // Simulate dragging slider
    fireEvent.change(slider, { target: { value: '-10' } });
    
    // Should not call immediately
    expect(mockOnChange).not.toHaveBeenCalled();
    
    // Fast forward debounce timer
    vi.advanceTimersByTime(100);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      frequency: 528,
      volume: -10,
    });
    
    vi.useRealTimers();
  });

  it('disables volume slider when no frequency is selected', () => {
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /volume/i });
    expect(slider).toBeDisabled();
  });

  it('shows volume value in dB', () => {
    render(
      <FrequencyPanel
        selectedFrequency={528}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('-16 dB')).toBeInTheDocument();
  });

  it('applies visual feedback for hover states', async () => {
    const user = userEvent.setup();
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const card = screen.getByTestId('frequency-card-528');
    
    // Hover over card
    await user.hover(card);
    expect(card).toHaveClass('hover:border-primary');
    
    // Unhover
    await user.unhover(card);
    expect(card).not.toHaveClass('hover:border-primary-active');
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    // Tab through frequency options
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

  it('shows tooltips on frequency cards', async () => {
    const user = userEvent.setup();
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const infoIcon = screen.getByTestId('info-icon-528');
    await user.hover(infoIcon);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        SOLFEGGIO_FREQUENCIES[528].description
      );
    });
  });

  it('handles rapid frequency changes gracefully', async () => {
    const user = userEvent.setup();
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    // Rapidly click different frequencies
    await user.click(screen.getByRole('radio', { name: /174 Hz/i }));
    await user.click(screen.getByRole('radio', { name: /285 Hz/i }));
    await user.click(screen.getByRole('radio', { name: /396 Hz/i }));

    // Should call onChange for each selection
    expect(mockOnChange).toHaveBeenCalledTimes(3);
    expect(mockOnChange).toHaveBeenLastCalledWith({
      frequency: 396,
      volume: -16,
    });
  });

  it('maintains volume when switching frequencies', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FrequencyPanel
        selectedFrequency={528}
        volume={-20}
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole('radio', { name: /639 Hz/i }));

    expect(mockOnChange).toHaveBeenCalledWith({
      frequency: 639,
      volume: -20, // Volume should remain the same
    });

    // Rerender with new props
    rerender(
      <FrequencyPanel
        selectedFrequency={639}
        volume={-20}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider', { name: /volume/i });
    expect(slider).toHaveAttribute('aria-valuenow', '-20');
  });

  it('provides accessible labels for screen readers', () => {
    render(
      <FrequencyPanel
        selectedFrequency={528}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('group', { name: /solfeggio frequency/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/frequency volume/i)).toBeInTheDocument();
  });

  it('displays frequency cards in grid layout on desktop', () => {
    render(
      <FrequencyPanel
        selectedFrequency={undefined}
        volume={-16}
        onChange={mockOnChange}
      />
    );

    const container = screen.getByTestId('frequency-grid');
    expect(container).toHaveClass('grid', 'grid-cols-3', 'lg:grid-cols-5');
  });
});
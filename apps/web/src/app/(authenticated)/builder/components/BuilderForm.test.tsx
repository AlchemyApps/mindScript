import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuilderForm } from './BuilderForm';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('BuilderForm', () => {
  const mockOnSubmit = vi.fn();
  
  const defaultProps = {
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    mockOnSubmit.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Form Structure', () => {
    it('renders all form sections', () => {
      render(<BuilderForm {...defaultProps} />);
      
      expect(screen.getByTestId('script-editor-section')).toBeInTheDocument();
      expect(screen.getByTestId('voice-selector-section')).toBeInTheDocument();
      expect(screen.getByTestId('music-browser-section')).toBeInTheDocument();
      expect(screen.getByTestId('frequency-controls-section')).toBeInTheDocument();
    });

    it('renders submit button', () => {
      render(<BuilderForm {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /create audio/i })).toBeInTheDocument();
    });

    it('shows form title and description', () => {
      render(<BuilderForm {...defaultProps} />);
      
      expect(screen.getByRole('heading', { name: /create your track/i })).toBeInTheDocument();
      expect(screen.getByText(/design your personalized audio experience/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows validation error for empty script', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/script must be at least 10 characters/i)).toBeInTheDocument();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows validation error for script too long', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      const longText = 'a'.repeat(5001);
      await user.type(scriptEditor, longText);
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/script must be no more than 5000 characters/i)).toBeInTheDocument();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('requires voice selection', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'This is a valid script for testing');
      
      // Deselect voice somehow (implementation specific)
      // ...
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/please select a voice/i)).toBeInTheDocument();
      });
    });

    it('validates volume ranges', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      // Try to set invalid volume (implementation would prevent this, but testing the validation)
      const volumeSlider = screen.getByRole('slider', { name: /music volume/i });
      
      // Volume should be between -20 and 0 dB
      expect(volumeSlider).toHaveAttribute('min', '-20');
      expect(volumeSlider).toHaveAttribute('max', '0');
    });

    it('submits valid form data', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      // Fill in valid form data
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'This is a meditation script for testing purposes');
      
      // Voice is pre-selected by default
      
      // Select music (optional)
      const musicCard = screen.getByText('Ocean Waves').closest('[data-track-card]');
      if (musicCard) await user.click(musicCard);
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          script: 'This is a meditation script for testing purposes',
          voice: expect.objectContaining({
            provider: expect.any(String),
            voice_id: expect.any(String),
          }),
          music: expect.any(Object),
          solfeggio: expect.any(Object),
          binaural: expect.any(Object),
        });
      });
    });
  });

  describe('Auto-save Functionality', () => {
    it('loads saved draft from localStorage on mount', () => {
      const savedDraft = {
        script: 'Saved draft content',
        voice: { provider: 'openai', voice_id: 'nova' },
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedDraft));
      
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      expect(scriptEditor).toHaveValue('Saved draft content');
    });

    it('auto-saves to localStorage every 10 seconds', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'New content to save');
      
      // Fast-forward 10 seconds
      vi.advanceTimersByTime(10000);
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'builder-draft',
          expect.stringContaining('New content to save')
        );
      });
    });

    it('shows auto-save indicator', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Content');
      
      // Fast-forward to trigger auto-save
      vi.advanceTimersByTime(10000);
      
      await waitFor(() => {
        expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
      });
    });

    it('clears draft after successful submission', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content for submission');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('builder-draft');
      });
    });

    it('debounces auto-save on rapid changes', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      
      // Type rapidly
      await user.type(scriptEditor, 'a');
      vi.advanceTimersByTime(1000);
      await user.type(scriptEditor, 'b');
      vi.advanceTimersByTime(1000);
      await user.type(scriptEditor, 'c');
      
      // Auto-save should not have triggered yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      
      // Fast-forward remaining time
      vi.advanceTimersByTime(8000);
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Responsive Layout', () => {
    it('uses sidebar layout on desktop', () => {
      render(<BuilderForm {...defaultProps} />);
      
      const container = screen.getByTestId('builder-container');
      expect(container).toHaveClass('lg:grid-cols-[300px_1fr]');
    });

    it('uses tabs on mobile', () => {
      render(<BuilderForm {...defaultProps} />);
      
      const container = screen.getByTestId('builder-container');
      expect(container).toHaveClass('grid-cols-1');
      
      // Should have tab navigation on mobile
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('shows step indicators on mobile', () => {
      render(<BuilderForm {...defaultProps} />);
      
      const stepIndicators = screen.getByTestId('step-indicators');
      expect(stepIndicators).toHaveClass('flex', 'lg:hidden');
    });
  });

  describe('Form State Management', () => {
    it('updates form state when script changes', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Updated script');
      
      expect(scriptEditor).toHaveValue('Updated script');
    });

    it('updates form state when voice changes', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const echoVoice = screen.getByRole('button', { name: /echo/i });
      await user.click(echoVoice);
      
      // Check that the voice is selected (visual indicator)
      expect(echoVoice.closest('[data-voice-card]')).toHaveClass('ring-2');
    });

    it('updates form state when music selection changes', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      // Assuming music tracks are loaded
      await waitFor(() => {
        expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      });
      
      const musicTrack = screen.getByText('Ocean Waves').closest('[data-track-card]');
      if (musicTrack) await user.click(musicTrack);
      
      expect(musicTrack).toHaveClass('ring-2');
    });

    it('updates form state for frequency controls', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const solfeggioToggle = screen.getByRole('switch', { name: /solfeggio/i });
      await user.click(solfeggioToggle);
      
      expect(solfeggioToggle).toBeChecked();
      
      // Frequency selector should appear
      expect(screen.getByRole('combobox', { name: /frequency/i })).toBeInTheDocument();
    });
  });

  describe('Submission Flow', () => {
    it('disables submit button while processing', async () => {
      const user = userEvent.setup({ delay: null });
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/creating/i)).toBeInTheDocument();
    });

    it('shows success message after submission', async () => {
      const user = userEvent.setup({ delay: null });
      mockOnSubmit.mockResolvedValue({ success: true, jobId: 'job-123' });
      
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/audio job created successfully/i)).toBeInTheDocument();
      });
    });

    it('shows error message on submission failure', async () => {
      const user = userEvent.setup({ delay: null });
      mockOnSubmit.mockRejectedValue(new Error('Network error'));
      
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to create audio/i)).toBeInTheDocument();
      });
    });

    it('allows retry after error', async () => {
      const user = userEvent.setup({ delay: null });
      mockOnSubmit
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });
      
      render(<BuilderForm {...defaultProps} />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to create audio/i)).toBeInTheDocument();
      });
      
      // Retry
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/audio job created successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form structure with fieldsets', () => {
      render(<BuilderForm {...defaultProps} />);
      
      expect(screen.getByRole('group', { name: /script/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /voice/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /music/i })).toBeInTheDocument();
    });

    it('provides keyboard navigation', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      // Tab through form elements
      await user.tab();
      expect(screen.getByRole('textbox', { name: /script editor/i })).toHaveFocus();
      
      await user.tab();
      // Should focus on next interactive element
    });

    it('announces form errors to screen readers', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BuilderForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const errorMessage = screen.getByText(/script must be at least 10 characters/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('has descriptive labels for all inputs', () => {
      render(<BuilderForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/script/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/voice provider/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/background music/i)).toBeInTheDocument();
    });
  });
});
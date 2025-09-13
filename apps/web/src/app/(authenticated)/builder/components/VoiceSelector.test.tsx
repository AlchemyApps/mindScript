import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceSelector } from './VoiceSelector';

const mockVoices = {
  openai: [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm and engaging' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Energetic and bright' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and gentle' },
  ],
  elevenlabs: [
    { id: 'rachel', name: 'Rachel', description: 'Natural female voice' },
    { id: 'adam', name: 'Adam', description: 'Natural male voice' },
  ],
};

describe('VoiceSelector', () => {
  const mockOnChange = vi.fn();
  const mockOnPreview = vi.fn();
  
  const defaultProps = {
    value: {
      provider: 'openai' as const,
      voice_id: 'alloy',
      settings: {
        speed: 1.0,
        pitch: 0,
      },
    },
    onChange: mockOnChange,
    onPreview: mockOnPreview,
  };

  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnPreview.mockClear();
  });

  describe('Provider Tabs', () => {
    it('renders all provider tabs', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      expect(screen.getByRole('tab', { name: /openai/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /elevenlabs/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /upload/i })).toBeInTheDocument();
    });

    it('shows active tab based on selected provider', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const openaiTab = screen.getByRole('tab', { name: /openai/i });
      expect(openaiTab).toHaveAttribute('aria-selected', 'true');
    });

    it('switches tabs when clicked', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const elevenLabsTab = screen.getByRole('tab', { name: /elevenlabs/i });
      await user.click(elevenLabsTab);
      
      expect(mockOnChange).toHaveBeenCalledWith({
        provider: 'elevenlabs',
        voice_id: expect.any(String),
        settings: expect.any(Object),
      });
    });
  });

  describe('OpenAI Voices', () => {
    it('displays all OpenAI voice cards', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      mockVoices.openai.forEach(voice => {
        expect(screen.getByText(voice.name)).toBeInTheDocument();
        expect(screen.getByText(voice.description)).toBeInTheDocument();
      });
    });

    it('highlights selected voice card', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const alloyCard = screen.getByRole('button', { name: /alloy/i }).closest('[data-voice-card]');
      expect(alloyCard).toHaveClass('ring-2');
    });

    it('selects voice when card clicked', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const echoCard = screen.getByRole('button', { name: /echo/i });
      await user.click(echoCard);
      
      expect(mockOnChange).toHaveBeenCalledWith({
        ...defaultProps.value,
        voice_id: 'echo',
      });
    });

    it('shows preview button for each voice', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const previewButtons = screen.getAllByRole('button', { name: /preview/i });
      expect(previewButtons).toHaveLength(mockVoices.openai.length);
    });

    it('calls onPreview when preview button clicked', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const previewButtons = screen.getAllByRole('button', { name: /preview/i });
      await user.click(previewButtons[0]);
      
      expect(mockOnPreview).toHaveBeenCalledWith('openai', 'alloy');
    });
  });

  describe('Speed and Pitch Controls', () => {
    it('renders speed control slider', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const speedSlider = screen.getByRole('slider', { name: /speed/i });
      expect(speedSlider).toBeInTheDocument();
      expect(speedSlider).toHaveAttribute('min', '0.25');
      expect(speedSlider).toHaveAttribute('max', '4');
      expect(speedSlider).toHaveAttribute('step', '0.25');
    });

    it('renders pitch control slider for providers that support it', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const pitchSlider = screen.getByRole('slider', { name: /pitch/i });
      expect(pitchSlider).toBeInTheDocument();
      expect(pitchSlider).toHaveAttribute('min', '-2');
      expect(pitchSlider).toHaveAttribute('max', '2');
      expect(pitchSlider).toHaveAttribute('step', '0.5');
    });

    it('updates speed when slider changed', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const speedSlider = screen.getByRole('slider', { name: /speed/i });
      await user.clear(speedSlider);
      await user.type(speedSlider, '1.5');
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          ...defaultProps.value,
          settings: {
            ...defaultProps.value.settings,
            speed: 1.5,
          },
        });
      });
    });

    it('displays current speed and pitch values', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      expect(screen.getByText('1.0x')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('has reset button for settings', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} value={{
        ...defaultProps.value,
        settings: { speed: 1.5, pitch: 1 },
      }} />);
      
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);
      
      expect(mockOnChange).toHaveBeenCalledWith({
        ...defaultProps.value,
        settings: { speed: 1.0, pitch: 0 },
      });
    });
  });

  describe('ElevenLabs Integration', () => {
    it('fetches and displays ElevenLabs voices', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const elevenLabsTab = screen.getByRole('tab', { name: /elevenlabs/i });
      await user.click(elevenLabsTab);
      
      await waitFor(() => {
        mockVoices.elevenlabs.forEach(voice => {
          expect(screen.getByText(voice.name)).toBeInTheDocument();
        });
      });
    });

    it('shows loading state while fetching voices', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const elevenLabsTab = screen.getByRole('tab', { name: /elevenlabs/i });
      await user.click(elevenLabsTab);
      
      expect(screen.getByText(/loading voices/i)).toBeInTheDocument();
    });

    it('shows error if voice fetch fails', async () => {
      const user = userEvent.setup();
      // Mock failed API call
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'));
      
      render(<VoiceSelector {...defaultProps} />);
      
      const elevenLabsTab = screen.getByRole('tab', { name: /elevenlabs/i });
      await user.click(elevenLabsTab);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load voices/i)).toBeInTheDocument();
      });
    });
  });

  describe('Voice Upload', () => {
    it('shows file upload interface when Upload tab selected', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const uploadTab = screen.getByRole('tab', { name: /upload/i });
      await user.click(uploadTab);
      
      expect(screen.getByLabelText(/choose file/i)).toBeInTheDocument();
      expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
    });

    it('accepts audio file uploads', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const uploadTab = screen.getByRole('tab', { name: /upload/i });
      await user.click(uploadTab);
      
      const file = new File(['audio'], 'voice.mp3', { type: 'audio/mp3' });
      const input = screen.getByLabelText(/choose file/i);
      
      await user.upload(input, file);
      
      expect(mockOnChange).toHaveBeenCalledWith({
        provider: 'uploaded',
        voice_id: expect.any(String),
        settings: expect.any(Object),
        file: file,
      });
    });

    it('validates file type', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const uploadTab = screen.getByRole('tab', { name: /upload/i });
      await user.click(uploadTab);
      
      const file = new File(['text'], 'document.txt', { type: 'text/plain' });
      const input = screen.getByLabelText(/choose file/i);
      
      await user.upload(input, file);
      
      expect(screen.getByText(/please upload an audio file/i)).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('shows file size limit', () => {
      render(<VoiceSelector {...defaultProps} value={{ ...defaultProps.value, provider: 'uploaded' }} />);
      
      expect(screen.getByText(/max 50mb/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for tabs', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Voice provider selection');
    });

    it('supports keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      render(<VoiceSelector {...defaultProps} />);
      
      const openaiTab = screen.getByRole('tab', { name: /openai/i });
      openaiTab.focus();
      
      // Arrow right to next tab
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /elevenlabs/i })).toHaveFocus();
      
      // Arrow left back
      await user.keyboard('{ArrowLeft}');
      expect(openaiTab).toHaveFocus();
    });

    it('announces selected voice to screen readers', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const selectedCard = screen.getByRole('button', { name: /alloy/i });
      expect(selectedCard).toHaveAttribute('aria-pressed', 'true');
    });

    it('has descriptive labels for all controls', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      expect(screen.getByRole('slider', { name: /speed/i })).toHaveAttribute('aria-valuetext', '1x speed');
      expect(screen.getByRole('slider', { name: /pitch/i })).toHaveAttribute('aria-valuetext', 'Normal pitch');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('stacks voice cards vertically on mobile', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const container = screen.getByTestId('voice-cards-container');
      expect(container).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
    });

    it('shows compact controls on mobile', () => {
      render(<VoiceSelector {...defaultProps} />);
      
      const controlsContainer = screen.getByTestId('voice-controls');
      expect(controlsContainer).toHaveClass('flex-col', 'sm:flex-row');
    });
  });
});
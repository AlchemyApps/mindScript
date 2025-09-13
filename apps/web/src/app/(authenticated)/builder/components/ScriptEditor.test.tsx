import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScriptEditor } from './ScriptEditor';

describe('ScriptEditor', () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: '',
    onChange: mockOnChange,
    maxLength: 5000,
    placeholder: 'Write your meditation script here...',
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Rendering', () => {
    it('renders textarea with proper attributes', () => {
      render(<ScriptEditor {...defaultProps} />);
      
      const textarea = screen.getByRole('textbox', { name: /script editor/i });
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', defaultProps.placeholder);
      expect(textarea).toHaveAttribute('maxLength', defaultProps.maxLength.toString());
    });

    it('displays character counter', () => {
      render(<ScriptEditor {...defaultProps} value="Hello world" />);
      
      expect(screen.getByText('11 / 5000')).toBeInTheDocument();
    });

    it('displays word count', () => {
      render(<ScriptEditor {...defaultProps} value="Hello world test" />);
      
      expect(screen.getByText(/3 words/i)).toBeInTheDocument();
    });

    it('shows line numbers when enabled', () => {
      render(<ScriptEditor {...defaultProps} showLineNumbers={true} value="Line 1\nLine 2\nLine 3" />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays markdown preview toggle when enabled', () => {
      render(<ScriptEditor {...defaultProps} enableMarkdownPreview={true} />);
      
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onChange when text is typed', async () => {
      const user = userEvent.setup();
      render(<ScriptEditor {...defaultProps} />);
      
      const textarea = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(textarea, 'Test content');
      
      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange).toHaveBeenLastCalledWith('Test content');
    });

    it('prevents typing beyond maxLength', async () => {
      const user = userEvent.setup();
      const longText = 'a'.repeat(5001);
      render(<ScriptEditor {...defaultProps} value={'a'.repeat(4999)} />);
      
      const textarea = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(textarea, 'bb');
      
      // Should only add one character to reach max
      expect(mockOnChange).toHaveBeenLastCalledWith('a'.repeat(4999) + 'b');
    });

    it('toggles markdown preview', async () => {
      const user = userEvent.setup();
      render(<ScriptEditor {...defaultProps} enableMarkdownPreview={true} value="# Hello\n**Bold text**" />);
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);
      
      // Should show rendered markdown
      expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
      expect(screen.getByText('Bold text')).toBeInTheDocument();
      
      // Click again to go back to editor
      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByRole('textbox', { name: /script editor/i })).toBeInTheDocument();
    });

    it('updates character counter in real-time', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ScriptEditor {...defaultProps} value="" />);
      
      expect(screen.getByText('0 / 5000')).toBeInTheDocument();
      
      rerender(<ScriptEditor {...defaultProps} value="Hello" />);
      expect(screen.getByText('5 / 5000')).toBeInTheDocument();
    });

    it('shows warning when approaching character limit', () => {
      render(<ScriptEditor {...defaultProps} value={'a'.repeat(4800)} />);
      
      expect(screen.getByText('4800 / 5000')).toHaveClass('text-yellow-600');
    });

    it('shows error when at character limit', () => {
      render(<ScriptEditor {...defaultProps} value={'a'.repeat(5000)} />);
      
      expect(screen.getByText('5000 / 5000')).toHaveClass('text-red-600');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ScriptEditor {...defaultProps} />);
      
      const textarea = screen.getByRole('textbox', { name: /script editor/i });
      expect(textarea).toHaveAttribute('aria-label', 'Script editor');
      expect(textarea).toHaveAttribute('aria-describedby', expect.stringContaining('character-count'));
    });

    it('announces character count changes to screen readers', async () => {
      const { rerender } = render(<ScriptEditor {...defaultProps} value="" />);
      
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      
      rerender(<ScriptEditor {...defaultProps} value={'a'.repeat(4900)} />);
      expect(liveRegion).toHaveTextContent('100 characters remaining');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ScriptEditor {...defaultProps} enableMarkdownPreview={true} />);
      
      // Tab to preview button
      await user.tab();
      const previewButton = screen.getByRole('button', { name: /preview/i });
      expect(previewButton).toHaveFocus();
      
      // Enter to toggle preview
      await user.keyboard('{Enter}');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('Example Script', () => {
    it('shows example script button when empty', () => {
      render(<ScriptEditor {...defaultProps} value="" showExample={true} />);
      
      expect(screen.getByRole('button', { name: /use example/i })).toBeInTheDocument();
    });

    it('fills in example script when button clicked', async () => {
      const user = userEvent.setup();
      render(<ScriptEditor {...defaultProps} value="" showExample={true} />);
      
      const exampleButton = screen.getByRole('button', { name: /use example/i });
      await user.click(exampleButton);
      
      expect(mockOnChange).toHaveBeenCalledWith(expect.stringContaining('Welcome to this guided meditation'));
    });
  });
});
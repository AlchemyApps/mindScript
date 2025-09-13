import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import BuilderPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/builder'),
}));

// Mock auth hook
vi.mock('@mindscript/auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', email: 'test@example.com' },
    session: { access_token: 'token-123' },
    loading: false,
  })),
}));

// Mock API calls
global.fetch = vi.fn();

describe('BuilderPage', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
    
    // Default successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ 
        success: true, 
        jobId: 'job-123',
        projectId: 'project-456' 
      }),
    });
  });

  describe('Page Layout', () => {
    it('renders page title and description', () => {
      render(<BuilderPage />);
      
      expect(screen.getByRole('heading', { name: /track builder/i })).toBeInTheDocument();
      expect(screen.getByText(/create your personalized audio experience/i)).toBeInTheDocument();
    });

    it('renders builder form', () => {
      render(<BuilderPage />);
      
      expect(screen.getByTestId('builder-form')).toBeInTheDocument();
    });

    it('shows breadcrumb navigation', () => {
      render(<BuilderPage />);
      
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByText(/builder/i)).toBeInTheDocument();
    });

    it('displays help section', () => {
      render(<BuilderPage />);
      
      expect(screen.getByRole('region', { name: /help/i })).toBeInTheDocument();
      expect(screen.getByText(/how to create your track/i)).toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    it('redirects to login if not authenticated', () => {
      vi.mock('@mindscript/auth', () => ({
        useAuth: vi.fn(() => ({
          user: null,
          session: null,
          loading: false,
        })),
      }));
      
      render(<BuilderPage />);
      
      expect(mockPush).toHaveBeenCalledWith('/auth/login?redirect=/builder');
    });

    it('shows loading state while checking auth', () => {
      vi.mock('@mindscript/auth', () => ({
        useAuth: vi.fn(() => ({
          user: null,
          session: null,
          loading: true,
        })),
      }));
      
      render(<BuilderPage />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits audio job to API', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      // Fill in form
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'This is my meditation script');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/audio/submit',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('This is my meditation script'),
          })
        );
      });
    });

    it('redirects to project page after successful submission', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/library/project-456');
      });
    });

    it('shows error message on submission failure', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to create audio/i)).toBeInTheDocument();
      });
    });

    it('handles API error responses', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ 
          error: 'Invalid voice selection' 
        }),
      });
      
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Valid script content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid voice selection/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('shows mobile layout on small screens', () => {
      // Mock window.matchMedia for mobile
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      render(<BuilderPage />);
      
      expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('desktop-layout')).not.toBeInTheDocument();
    });

    it('shows desktop layout on large screens', () => {
      // Mock window.matchMedia for desktop
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(min-width: 1024px)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      render(<BuilderPage />);
      
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-layout')).not.toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('shows progress indicator for form completion', () => {
      render(<BuilderPage />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('updates progress as form is filled', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      const progressBar = screen.getByRole('progressbar');
      
      // Fill script
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Script content');
      
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '25');
      });
      
      // Select voice (already selected by default, so progress should update)
      // Select music
      const musicCard = screen.getByText('Ocean Waves').closest('[data-track-card]');
      if (musicCard) await user.click(musicCard);
      
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('supports keyboard shortcut for save draft', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Content to save');
      
      // Press Ctrl+S / Cmd+S
      await user.keyboard('{Control>}s{/Control}');
      
      await waitFor(() => {
        expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
      });
    });

    it('supports keyboard shortcut for preview', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      // Press Ctrl+P / Cmd+P for preview
      await user.keyboard('{Control>}p{/Control}');
      
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /preview/i })).toBeInTheDocument();
      });
    });

    it('shows keyboard shortcuts help with ?', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      await user.keyboard('?');
      
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();
      });
    });
  });

  describe('Preview Mode', () => {
    it('shows preview dialog before submission', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Preview this content');
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);
      
      expect(screen.getByRole('dialog', { name: /preview your track/i })).toBeInTheDocument();
      expect(screen.getByText('Preview this content')).toBeInTheDocument();
    });

    it('displays selected options in preview', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Content');
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent(/voice: alloy/i);
      expect(dialog).toHaveTextContent(/speed: 1.0x/i);
    });

    it('allows editing from preview', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Content');
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(scriptEditor).toHaveFocus();
    });
  });

  describe('Error Recovery', () => {
    it('preserves form data after error', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Preserved content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to create audio/i)).toBeInTheDocument();
      });
      
      // Form data should be preserved
      expect(scriptEditor).toHaveValue('Preserved content');
    });

    it('allows retry with same data', async () => {
      const user = userEvent.setup();
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, jobId: 'job-123' }),
        });
      
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Retry content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      
      // First attempt fails
      await user.click(submitButton);
      await waitFor(() => {
        expect(screen.getByText(/failed to create audio/i)).toBeInTheDocument();
      });
      
      // Retry succeeds
      await user.click(submitButton);
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/library'));
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper page structure with landmarks', () => {
      render(<BuilderPage />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /help/i })).toBeInTheDocument();
    });

    it('announces status changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<BuilderPage />);
      
      const scriptEditor = screen.getByRole('textbox', { name: /script editor/i });
      await user.type(scriptEditor, 'Content');
      
      const submitButton = screen.getByRole('button', { name: /create audio/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toHaveTextContent(/creating audio/i);
      });
    });

    it('provides skip navigation link', () => {
      render(<BuilderPage />);
      
      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });
});
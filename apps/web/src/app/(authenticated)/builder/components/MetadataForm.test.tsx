import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetadataForm } from './MetadataForm';
import { usePublishStore } from '@/store/publishStore';

// Mock the store
vi.mock('@/store/publishStore', () => ({
  usePublishStore: vi.fn(),
}));

// Mock the tag suggestions API
vi.mock('@/lib/api', () => ({
  fetchTagSuggestions: vi.fn().mockResolvedValue({
    tags: [
      { value: 'meditation', count: 100, relevance: 0.9 },
      { value: 'relaxation', count: 80, relevance: 0.8 },
      { value: 'sleep', count: 60, relevance: 0.7 },
    ],
  }),
}));

describe('MetadataForm', () => {
  const mockStore = {
    metadata: {
      title: '',
      description: '',
      tags: [],
      category: undefined,
      visibility: undefined,
    },
    updateMetadata: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePublishStore as any).mockReturnValue(mockStore);
  });

  describe('Step 1: Basic Metadata', () => {
    it('should render title input', () => {
      render(<MetadataForm currentStep={1} />);
      
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    it('should render description textarea', () => {
      render(<MetadataForm currentStep={1} />);
      
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should render tag input', () => {
      render(<MetadataForm currentStep={1} />);
      
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    it('should update title on input', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, 'My Meditation Track');
      
      await waitFor(() => {
        expect(mockStore.updateMetadata).toHaveBeenCalledWith({
          title: 'My Meditation Track',
        });
      });
    });

    it('should show character count for title', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, 'Test Title');
      
      expect(screen.getByText('10 / 100')).toBeInTheDocument();
    });

    it('should validate title length', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, 'ab'); // Too short
      
      await waitFor(() => {
        expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('should update description on input', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'A relaxing meditation track');
      
      await waitFor(() => {
        expect(mockStore.updateMetadata).toHaveBeenCalledWith({
          description: 'A relaxing meditation track',
        });
      });
    });

    it('should show character count for description', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'Test description');
      
      expect(screen.getByText('16 / 500')).toBeInTheDocument();
    });

    it('should handle tag addition', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const tagInput = screen.getByLabelText(/tags/i);
      await userEvent.type(tagInput, 'meditation{enter}');
      
      await waitFor(() => {
        expect(mockStore.updateMetadata).toHaveBeenCalledWith({
          tags: ['meditation'],
        });
      });
    });

    it('should validate tag format', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const tagInput = screen.getByLabelText(/tags/i);
      await userEvent.type(tagInput, 'Invalid Tag!{enter}'); // Invalid characters
      
      await waitFor(() => {
        expect(screen.getByText(/lowercase alphanumeric/i)).toBeInTheDocument();
      });
    });

    it('should limit tags to 10', async () => {
      const storeWithTags = {
        ...mockStore,
        metadata: {
          ...mockStore.metadata,
          tags: Array(10).fill('tag'),
        },
      };
      (usePublishStore as any).mockReturnValue(storeWithTags);
      
      render(<MetadataForm currentStep={1} />);
      
      const tagInput = screen.getByLabelText(/tags/i);
      await userEvent.type(tagInput, 'newtag{enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/maximum 10 tags/i)).toBeInTheDocument();
      });
    });

    it('should show tag suggestions', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const tagInput = screen.getByLabelText(/tags/i);
      await userEvent.type(tagInput, 'med');
      
      await waitFor(() => {
        expect(screen.getByText('meditation')).toBeInTheDocument();
      });
    });

    it('should remove tags', async () => {
      const storeWithTags = {
        ...mockStore,
        metadata: {
          ...mockStore.metadata,
          tags: ['meditation', 'sleep'],
        },
      };
      (usePublishStore as any).mockReturnValue(storeWithTags);
      
      render(<MetadataForm currentStep={1} />);
      
      const removeButton = screen.getAllByLabelText(/remove tag/i)[0];
      await userEvent.click(removeButton);
      
      await waitFor(() => {
        expect(mockStore.updateMetadata).toHaveBeenCalledWith({
          tags: ['sleep'],
        });
      });
    });
  });

  describe('Step 2: Category & Settings', () => {
    it('should render category selector', () => {
      render(<MetadataForm currentStep={2} />);
      
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it('should render visibility toggle', () => {
      render(<MetadataForm currentStep={2} />);
      
      expect(screen.getByLabelText(/visibility/i)).toBeInTheDocument();
    });

    it('should display all category options', () => {
      render(<MetadataForm currentStep={2} />);
      
      const categories = ['Meditation', 'Sleep', 'Focus', 'Relaxation', 'Energy', 'Healing'];
      categories.forEach(category => {
        expect(screen.getByText(category)).toBeInTheDocument();
      });
    });

    it('should select category', async () => {
      render(<MetadataForm currentStep={2} />);
      
      const meditationButton = screen.getByText('Meditation');
      await userEvent.click(meditationButton);
      
      expect(mockStore.updateMetadata).toHaveBeenCalledWith({
        category: 'Meditation',
      });
    });

    it('should toggle visibility', async () => {
      render(<MetadataForm currentStep={2} />);
      
      const publicButton = screen.getByText('Public');
      await userEvent.click(publicButton);
      
      expect(mockStore.updateMetadata).toHaveBeenCalledWith({
        visibility: 'public',
      });
      
      const privateButton = screen.getByText('Private');
      await userEvent.click(privateButton);
      
      expect(mockStore.updateMetadata).toHaveBeenCalledWith({
        visibility: 'private',
      });
    });

    it('should show SEO preview for public tracks', async () => {
      const storeWithPublic = {
        ...mockStore,
        metadata: {
          ...mockStore.metadata,
          title: 'Test Track',
          description: 'Test Description',
          visibility: 'public',
        },
      };
      (usePublishStore as any).mockReturnValue(storeWithPublic);
      
      render(<MetadataForm currentStep={2} />);
      
      expect(screen.getByText('SEO Preview')).toBeInTheDocument();
      expect(screen.getByText('Test Track')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });

    it('should not show SEO preview for private tracks', () => {
      const storeWithPrivate = {
        ...mockStore,
        metadata: {
          ...mockStore.metadata,
          visibility: 'private',
        },
      };
      (usePublishStore as any).mockReturnValue(storeWithPrivate);
      
      render(<MetadataForm currentStep={2} />);
      
      expect(screen.queryByText('SEO Preview')).not.toBeInTheDocument();
    });

    it('should suggest tags based on category', async () => {
      render(<MetadataForm currentStep={2} />);
      
      const meditationButton = screen.getByText('Meditation');
      await userEvent.click(meditationButton);
      
      await waitFor(() => {
        expect(screen.getByText('Suggested tags:')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, 'a'); // Too short
      await userEvent.tab(); // Blur to trigger validation
      
      await waitFor(() => {
        expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('should clear validation errors when fixed', async () => {
      render(<MetadataForm currentStep={1} />);
      
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, 'a'); // Too short
      await userEvent.tab(); // Blur to trigger validation
      
      await waitFor(() => {
        expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
      });
      
      await userEvent.type(titleInput, 'bcd'); // Now valid
      
      await waitFor(() => {
        expect(screen.queryByText(/at least 3 characters/i)).not.toBeInTheDocument();
      });
    });
  });
});
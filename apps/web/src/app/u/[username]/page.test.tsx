import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import SellerProfile, { generateStaticParams, generateMetadata } from './page';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock data
const mockSeller = {
  id: 'seller-123',
  username: 'johndoe',
  display_name: 'John Doe',
  bio: 'Audio creator',
  avatar_url: 'https://example.com/avatar.jpg',
  is_seller: true,
  seller_status: 'active',
};

const mockTracks = [
  {
    id: 'track-1',
    title: 'Meditation Track 1',
    slug: 'meditation-track-1',
    description: 'A calming meditation track',
    audio_url: 'https://example.com/audio1.mp3',
    duration: 600,
    price: 999,
    thumbnail_url: 'https://example.com/thumb1.jpg',
    published: true,
    plays_count: 100,
    favorites_count: 10,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'track-2',
    title: 'Sleep Sound 1',
    slug: 'sleep-sound-1',
    description: 'Peaceful sleep sounds',
    audio_url: 'https://example.com/audio2.mp3',
    duration: 1800,
    price: 1499,
    thumbnail_url: 'https://example.com/thumb2.jpg',
    published: true,
    plays_count: 50,
    favorites_count: 5,
    created_at: '2024-01-02T00:00:00Z',
  },
];

const mockStats = {
  total_tracks: 10,
  total_plays: 500,
  total_sales: 25,
};

describe('Seller Profile Page', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      count: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    };
  });

  describe('generateStaticParams', () => {
    it('should generate params for active sellers', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      mockSupabase.limit.mockResolvedValue({
        data: [
          { username: 'seller1' },
          { username: 'seller2' },
        ],
        error: null,
      });

      (createClient as any).mockResolvedValue(mockSupabase);

      const params = await generateStaticParams();

      expect(params).toEqual([
        { sellerSlug: 'seller1' },
        { sellerSlug: 'seller2' },
      ]);

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_seller', true);
      expect(mockSupabase.eq).toHaveBeenCalledWith('seller_status', 'active');
    });

    it('should return empty array on error', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      mockSupabase.limit.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      (createClient as any).mockResolvedValue(mockSupabase);

      const params = await generateStaticParams();

      expect(params).toEqual([]);
    });
  });

  describe('generateMetadata', () => {
    it('should generate metadata for valid seller', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      mockSupabase.single.mockResolvedValue({
        data: mockSeller,
        error: null,
      });

      (createClient as any).mockResolvedValue(mockSupabase);

      const metadata = await generateMetadata({
        params: { sellerSlug: 'johndoe' },
      });

      expect(metadata.title).toBe('John Doe - MindScript Creator');
      expect(metadata.description).toBe('Audio creator');
      expect(metadata.openGraph?.title).toBe('John Doe - MindScript Creator');
      expect(metadata.openGraph?.description).toBe('Audio creator');
      expect(metadata.openGraph?.url).toBe('https://mindscript.app/u/johndoe');
    });

    it('should generate fallback metadata for unknown seller', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      (createClient as any).mockResolvedValue(mockSupabase);

      const metadata = await generateMetadata({
        params: { sellerSlug: 'unknown' },
      });

      expect(metadata.title).toBe('Creator Profile - MindScript');
      expect(metadata.robots?.index).toBe(false);
    });
  });

  describe('SellerProfile Component', () => {
    it('should render seller profile with tracks', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      // Mock seller query
      const sellerMock = {
        ...mockSupabase,
        single: vi.fn().mockResolvedValue({
          data: mockSeller,
          error: null,
        }),
      };

      // Mock tracks query
      const tracksMock = {
        ...mockSupabase,
        data: mockTracks,
        error: null,
        count: 2,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockSeller,
        error: null,
      });

      mockSupabase.count.mockResolvedValueOnce(tracksMock);

      (createClient as any).mockResolvedValue(mockSupabase);

      const component = await SellerProfile({
        params: { sellerSlug: 'johndoe' },
      });

      // Check if the component renders correctly
      const { container } = render(component as any);

      // Check for JSON-LD
      const jsonLd = container.querySelector('script[type="application/ld+json"]');
      expect(jsonLd).toBeTruthy();

      if (jsonLd) {
        const data = JSON.parse(jsonLd.textContent || '{}');
        expect(data['@type']).toBe('Person');
        expect(data.name).toBe('John Doe');
        expect(data.url).toContain('/u/johndoe');
      }
    });

    it('should show not found for non-existent seller', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      (createClient as any).mockResolvedValue(mockSupabase);

      const component = await SellerProfile({
        params: { sellerSlug: 'nonexistent' },
      });

      const { container } = render(component as any);

      expect(container.textContent).toContain('Seller not found');
    });

    it('should show not found for inactive seller', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      const inactiveSeller = {
        ...mockSeller,
        is_seller: false,
      };

      mockSupabase.single.mockResolvedValue({
        data: inactiveSeller,
        error: null,
      });

      (createClient as any).mockResolvedValue(mockSupabase);

      const component = await SellerProfile({
        params: { sellerSlug: 'inactive' },
      });

      const { container } = render(component as any);

      expect(container.textContent).toContain('Seller not found');
    });
  });
});
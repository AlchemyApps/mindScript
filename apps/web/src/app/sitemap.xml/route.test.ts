import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createClient } from '@/utils/supabase/server';

// Mock Supabase client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Sitemap Route', () => {
  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockReturnValue(mockSupabase);
  });

  it('should generate sitemap with static pages', async () => {
    // Mock database responses
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'tracks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }
      if (table === 'playlists') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }
    });

    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/xml');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=3600');

    // Check for static pages
    expect(xml).toContain('<loc>https://mindscript.app/</loc>');
    expect(xml).toContain('<loc>https://mindscript.app/marketplace</loc>');
    expect(xml).toContain('<loc>https://mindscript.app/auth/login</loc>');
    expect(xml).toContain('<loc>https://mindscript.app/auth/signup</loc>');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('should include public tracks in sitemap', async () => {
    const mockTracks = [
      {
        id: 'track-1',
        user_id: 'user-1',
        title: 'Meditation Track 1',
        updated_at: '2024-01-01T00:00:00Z',
        profiles: {
          username: 'johndoe',
        },
      },
      {
        id: 'track-2',
        user_id: 'user-2',
        title: 'Meditation Track 2',
        updated_at: '2024-01-02T00:00:00Z',
        profiles: {
          username: 'janedoe',
        },
      },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'tracks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockTracks,
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
    });

    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain('<loc>https://mindscript.app/u/johndoe/track-1</loc>');
    expect(xml).toContain('<loc>https://mindscript.app/u/janedoe/track-2</loc>');
    expect(xml).toContain('<lastmod>2024-01-01</lastmod>');
    expect(xml).toContain('<lastmod>2024-01-02</lastmod>');
  });

  it('should include seller profiles in sitemap', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        username: 'seller1',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'user-2',
        username: 'seller2',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
    });

    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain('<loc>https://mindscript.app/u/seller1</loc>');
    expect(xml).toContain('<loc>https://mindscript.app/u/seller2</loc>');
  });

  it('should handle database errors gracefully', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      }),
    }));

    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    // Should still return static pages even if database fails
    expect(xml).toContain('<loc>https://mindscript.app/</loc>');
    expect(xml).toContain('<loc>https://mindscript.app/marketplace</loc>');
  });

  it('should return sitemap index for large number of URLs', async () => {
    // Create more than 50000 mock tracks to trigger sitemap index
    const mockTracks = Array.from({ length: 51000 }, (_, i) => ({
      id: `track-${i}`,
      user_id: `user-${i}`,
      title: `Track ${i}`,
      updated_at: '2024-01-01T00:00:00Z',
      profiles: {
        username: `user${i}`,
      },
    }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'tracks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockTracks,
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
    });

    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<sitemap>');
    expect(xml).toContain('<loc>https://mindscript.app/sitemap-1.xml</loc>');
    expect(xml).toContain('<loc>https://mindscript.app/sitemap-2.xml</loc>');
  });
});
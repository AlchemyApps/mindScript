import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('GET /api/library/tracks', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    };
    (createClient as any).mockResolvedValue(mockSupabase);
  });

  it('should require authentication', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new NextRequest('http://localhost:3000/api/library/tracks');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return user owned tracks', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockTracks = [
      {
        id: 'track-1',
        title: 'My Track 1',
        description: 'Test track',
        owner_id: 'user-123',
        status: 'published',
        created_at: '2024-01-01T00:00:00Z',
        audio_file_url: '/audio/track1.mp3',
        duration: 180,
        profiles: { display_name: 'Test User' },
      },
      {
        id: 'track-2',
        title: 'My Track 2',
        description: 'Another track',
        owner_id: 'user-123',
        status: 'draft',
        created_at: '2024-01-02T00:00:00Z',
        audio_file_url: null,
        duration: 0,
        profiles: { display_name: 'Test User' },
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const ownedQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
    };
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'tracks') return ownedQuery;
      return { select: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost:3000/api/library/tracks?ownership=owned');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tracks).toHaveLength(2);
    expect(data.tracks[0].ownership).toBe('owned');
    expect(ownedQuery.eq).toHaveBeenCalledWith('owner_id', 'user-123');
  });

  it('should return purchased tracks', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockPurchasedTracks = [
      {
        track_id: 'track-3',
        tracks: {
          id: 'track-3',
          title: 'Purchased Track',
          description: 'Bought this one',
          owner_id: 'seller-456',
          status: 'published',
          created_at: '2024-01-03T00:00:00Z',
          audio_file_url: '/audio/track3.mp3',
          duration: 240,
          profiles: { display_name: 'Seller Name' },
        },
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const purchasedQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockPurchasedTracks, error: null }),
    };
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'track_access') return purchasedQuery;
      return { select: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest('http://localhost:3000/api/library/tracks?ownership=purchased');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tracks).toHaveLength(1);
    expect(data.tracks[0].ownership).toBe('purchased');
    expect(purchasedQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  it('should filter by status', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockTracks = [
      {
        id: 'track-1',
        title: 'Published Track',
        status: 'published',
        owner_id: 'user-123',
        created_at: '2024-01-01T00:00:00Z',
        profiles: { display_name: 'Test User' },
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
    };
    
    mockSupabase.from.mockReturnValue(query);

    const req = new NextRequest('http://localhost:3000/api/library/tracks?status=published');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith('status', 'published');
  });

  it('should handle search query', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockTracks = [
      {
        id: 'track-1',
        title: 'Meditation Track',
        description: 'Relaxing meditation',
        owner_id: 'user-123',
        status: 'published',
        created_at: '2024-01-01T00:00:00Z',
        profiles: { display_name: 'Test User' },
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
    };
    
    mockSupabase.from.mockReturnValue(query);

    const req = new NextRequest('http://localhost:3000/api/library/tracks?search=meditation');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(query.or).toHaveBeenCalled();
  });

  it('should handle sorting', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockTracks = [
      {
        id: 'track-1',
        title: 'Track A',
        owner_id: 'user-123',
        created_at: '2024-01-01T00:00:00Z',
        profiles: { display_name: 'Test User' },
      },
      {
        id: 'track-2',
        title: 'Track B',
        owner_id: 'user-123',
        created_at: '2024-01-02T00:00:00Z',
        profiles: { display_name: 'Test User' },
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
    };
    
    mockSupabase.from.mockReturnValue(query);

    const req = new NextRequest('http://localhost:3000/api/library/tracks?sort=title&order=asc');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(query.order).toHaveBeenCalledWith('title', { ascending: true });
  });

  it('should handle pagination', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockTracks = Array.from({ length: 5 }, (_, i) => ({
      id: `track-${i + 1}`,
      title: `Track ${i + 1}`,
      owner_id: 'user-123',
      created_at: `2024-01-0${i + 1}T00:00:00Z`,
      profiles: { display_name: 'Test User' },
    }));

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockTracks.slice(0, 3), error: null }),
    };
    
    mockSupabase.from.mockReturnValue(query);

    const req = new NextRequest('http://localhost:3000/api/library/tracks?page=1&limit=3');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(query.range).toHaveBeenCalledWith(0, 2);
    expect(data.tracks).toHaveLength(3);
  });

  it('should include render status for owned tracks', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockTracks = [
      {
        id: 'track-1',
        title: 'Track with Render',
        owner_id: 'user-123',
        status: 'rendering',
        created_at: '2024-01-01T00:00:00Z',
        profiles: { display_name: 'Test User' },
        audio_job_queue: [
          {
            id: 'job-1',
            status: 'processing',
            progress: 45,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const query = {
      select: vi.fn((fields: string) => {
        // Check if audio_job_queue is included in select
        expect(fields).toContain('audio_job_queue');
        return query;
      }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTracks, error: null }),
    };
    
    mockSupabase.from.mockReturnValue(query);

    const req = new NextRequest('http://localhost:3000/api/library/tracks?includeRenderStatus=true');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tracks[0].renderStatus).toBeDefined();
    expect(data.tracks[0].renderStatus.progress).toBe(45);
  });

  it('should handle database errors gracefully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
    };
    
    mockSupabase.from.mockReturnValue(query);

    const req = new NextRequest('http://localhost:3000/api/library/tracks');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch tracks');
  });
});
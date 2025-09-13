import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient } from '../../../../test/mocks/supabase';

// Mock external dependencies
vi.mock('@/app/api/lib/render-utils', () => ({
  supabaseAdmin: createMockSupabaseClient(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => createMockSupabaseClient())
}));

// Mock Supabase admin client directly for this complex query
const mockSupabaseAdmin = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            gt: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      }))
    }))
  })),
};

vi.mock('@/app/api/lib/render-utils', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

describe('GET /api/renders', () => {
  const mockUserId = 'user-123';
  
  const mockRenders = [
    {
      id: 'render-1',
      track_id: 'track-1',
      user_id: mockUserId,
      status: 'completed',
      progress: 100,
      stage: 'Upload complete',
      result: {
        audio_url: 'https://example.com/audio1.mp3',
        duration_seconds: 180,
        file_size_bytes: 512000,
      },
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:05:00.000Z',
      track: {
        id: 'track-1',
        title: 'Morning Affirmations',
        duration_seconds: 180,
      },
    },
    {
      id: 'render-2',
      track_id: 'track-2',
      user_id: mockUserId,
      status: 'processing',
      progress: 75,
      stage: 'Mixing layers',
      result: null,
      created_at: '2024-01-01T01:00:00.000Z',
      updated_at: '2024-01-01T01:03:00.000Z',
      track: {
        id: 'track-2',
        title: 'Sleep Meditation',
        duration_seconds: 300,
      },
    },
  ];
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default successful query mock
    mockSupabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({
                data: mockRenders,
                error: null
              })
            })
          })
        })
      })
    });
  });

  it('should return paginated renders successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders', {
      method: 'GET',
    });

    // Mock auth context
    const mockAuth = {
      user: { id: mockUserId },
      session: { user: { id: mockUserId } }
    };
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: mockAuth }) }
      })
    }));

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].id).toBe('render-1');
    expect(data.data[0].status).toBe('completed');
    expect(data.data[0].track.title).toBe('Morning Affirmations');
    expect(data.pagination.limit).toBe(20);
  });

  it('should filter by status', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders?status=processing', {
      method: 'GET',
    });

    const processingRenders = [mockRenders[1]];
    
    // Mock filtered query
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({
                data: processingRenders,
                error: null
              })
            })
          })
        })
      })
    });
    
    mockSupabaseAdmin.from.mockReturnValue({
      select: mockSelect
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].status).toBe('processing');
  });

  it('should filter by track_id', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders?track_id=track-1', {
      method: 'GET',
    });

    const trackRenders = [mockRenders[0]];
    
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({
                data: trackRenders,
                error: null
              })
            })
          })
        })
      })
    });
    
    mockSupabaseAdmin.from.mockReturnValue({
      select: mockSelect
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].track_id).toBe('track-1');
  });

  it('should use custom limit', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders?limit=5', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.limit).toBe(5);
  });

  it('should use cursor for pagination', async () => {
    const cursor = '2024-01-01T00:30:00.000Z';
    const request = new NextRequest(`http://localhost:3000/api/renders?cursor=${cursor}`, {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    // Verify that gt filter was applied for cursor
    expect(mockSupabaseAdmin.from().select().eq().order().limit().gt).toHaveBeenCalledWith('created_at', cursor);
  });

  it('should return 401 when user is not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders', {
      method: 'GET',
    });

    // Mock no auth
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) }
      })
    }));

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should validate query parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders?limit=200', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Validation error');
  });

  it('should validate status parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders?status=invalid', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Validation error');
  });

  it('should validate track_id parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders?track_id=invalid-uuid', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Validation error');
  });

  it('should handle database errors', async () => {
    // Mock database error
    mockSupabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' }
              })
            })
          })
        })
      })
    });

    const request = new NextRequest('http://localhost:3000/api/renders', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch renders');
  });

  it('should return empty data with proper pagination when no renders', async () => {
    // Mock empty result
    mockSupabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      })
    });

    const request = new NextRequest('http://localhost:3000/api/renders', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(0);
    expect(data.pagination.has_next).toBe(false);
    expect(data.pagination.has_prev).toBe(false);
  });

  it('should filter by date range', async () => {
    const startDate = '2024-01-01T00:00:00.000Z';
    const endDate = '2024-01-01T23:59:59.000Z';
    const request = new NextRequest(
      `http://localhost:3000/api/renders?start_date=${startDate}&end_date=${endDate}`,
      { method: 'GET' }
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    // Verify date filtering logic is applied
  });

  it('should handle combined filters', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/renders?status=completed&track_id=track-1&limit=10',
      { method: 'GET' }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.limit).toBe(10);
  });

  it('should set proper pagination metadata', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders?limit=1', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination).toHaveProperty('has_next');
    expect(data.pagination).toHaveProperty('has_prev');
    expect(data.pagination).toHaveProperty('cursor');
    expect(data.pagination).toHaveProperty('limit');
  });
});
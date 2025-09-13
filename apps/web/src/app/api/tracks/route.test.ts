import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { createMockSupabaseClient } from '@/test/mocks/supabase';

// Mock the auth module
vi.mock('@mindscript/auth/server', () => ({
  createServerClient: vi.fn(),
}));

// Mock the schemas
vi.mock('@mindscript/schemas', () => ({
  CreateTrackSchema: {
    parse: vi.fn(),
  },
  ListTracksSchema: {
    parse: vi.fn(),
  },
  validateTrackConfig: vi.fn(),
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
};

const mockTrack = {
  id: 'track-123',
  user_id: 'user-123',
  title: 'Test Track',
  description: 'A test track',
  script: 'This is a test script for the track',
  voice_config: {
    provider: 'openai',
    voice_id: 'alloy',
  },
  output_config: {
    format: 'mp3',
    quality: 'standard',
    is_public: false,
  },
  status: 'draft',
  tags: ['test'],
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

describe('/api/tracks', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/tracks', () => {
    it('should return tracks with default pagination', async () => {
      // Mock successful auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock successful tracks query
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [mockTrack],
                    error: null,
                    count: 1,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toEqual(mockTrack);
      expect(data.pagination).toMatchObject({
        limit: 20,
        has_next: false,
        has_prev: false,
      });
    });

    it('should filter tracks by status', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const publishedTrack = { ...mockTrack, status: 'published' };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [publishedTrack],
                    error: null,
                    count: 1,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks?status=published');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data[0].status).toBe('published');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = new NextRequest('http://localhost:3000/api/tracks');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' },
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should handle cursor-based pagination', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({
                      data: [mockTrack],
                      error: null,
                      count: 1,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const cursor = 'cursor-123';
      const request = new NextRequest(`http://localhost:3000/api/tracks?cursor=${cursor}`);
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/tracks', () => {
    const validTrackData = {
      title: 'New Track',
      script: 'This is a new track script',
      voice_config: {
        provider: 'openai',
        voice_id: 'alloy',
      },
      output_config: {
        format: 'mp3',
        quality: 'standard',
        is_public: false,
      },
    };

    it('should create a new track successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const createdTrack = { ...mockTrack, ...validTrackData };
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [createdTrack],
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks', {
        method: 'POST',
        body: JSON.stringify(validTrackData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe(validTrackData.title);
      expect(data.user_id).toBe(mockUser.id);
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = new NextRequest('http://localhost:3000/api/tracks', {
        method: 'POST',
        body: JSON.stringify(validTrackData),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const invalidData = { title: '' }; // Invalid: missing required fields

      const request = new NextRequest('http://localhost:3000/api/tracks', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle database insertion errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed' },
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks', {
        method: 'POST',
        body: JSON.stringify(validTrackData),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should set default status to draft', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const createdTrack = { ...mockTrack, ...validTrackData, status: 'draft' };
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [createdTrack],
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks', {
        method: 'POST',
        body: JSON.stringify(validTrackData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.status).toBe('draft');
    });
  });
});
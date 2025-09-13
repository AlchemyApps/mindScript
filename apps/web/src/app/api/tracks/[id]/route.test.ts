import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from './route';
import { createMockSupabaseClient } from '@/test/mocks/supabase';

// Mock the auth module
vi.mock('@mindscript/auth/server', () => ({
  createServerClient: vi.fn(),
}));

// Mock the schemas
vi.mock('@mindscript/schemas', () => ({
  UpdateTrackSchema: {
    parse: vi.fn(),
  },
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
  owner: {
    id: 'user-123',
    display_name: 'Test User',
  },
};

describe('/api/tracks/[id]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/tracks/[id]', () => {
    it('should return track details for owner', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTrack,
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123');
      const response = await GET(request, { params: { id: 'track-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('track-123');
      expect(data.title).toBe('Test Track');
    });

    it('should return public track details for any user', async () => {
      const publicTrack = { ...mockTrack, is_public: true, user_id: 'other-user' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: publicTrack,
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123');
      const response = await GET(request, { params: { id: 'track-123' } });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent track', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Track not found' },
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/nonexistent');
      const response = await GET(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
    });

    it('should return 403 for private track not owned by user', async () => {
      const privateTrack = { ...mockTrack, is_public: false, user_id: 'other-user' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: privateTrack,
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123');
      const response = await GET(request, { params: { id: 'track-123' } });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/tracks/[id]', () => {
    const updateData = {
      title: 'Updated Track Title',
      description: 'Updated description',
      tags: ['updated', 'test'],
    };

    it('should update track successfully for owner', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // First call to check ownership
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [mockTrack],
            error: null,
          }),
        }),
      });

      // Second call to update
      const updatedTrack = { ...mockTrack, ...updateData };
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [updatedTrack],
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request, { params: { id: 'track-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe(updateData.title);
      expect(data.description).toBe(updateData.description);
    });

    it('should return 403 for non-owner trying to update', async () => {
      const otherUserTrack = { ...mockTrack, user_id: 'other-user' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [otherUserTrack],
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request, { params: { id: 'track-123' } });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent track', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/nonexistent', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
    });

    it('should handle validation errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const invalidData = { title: '' }; // Empty title should fail validation

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
      });

      const response = await PUT(request, { params: { id: 'track-123' } });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tracks/[id]', () => {
    it('should soft delete track for owner', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // First call to check ownership
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [mockTrack],
            error: null,
          }),
        }),
      });

      // Second call to soft delete
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'track-123' } });

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-owner trying to delete', async () => {
      const otherUserTrack = { ...mockTrack, user_id: 'other-user' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [otherUserTrack],
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'track-123' } });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent track', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/tracks/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
    });

    it('should handle storage cleanup on delete', async () => {
      const trackWithAudio = { ...mockTrack, audio_url: 'https://example.com/audio.mp3' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock ownership check
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [trackWithAudio],
            error: null,
          }),
        }),
      });

      // Mock soft delete
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      // Mock storage deletion
      mockSupabase.storage = {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      };

      const request = new NextRequest('http://localhost:3000/api/tracks/track-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'track-123' } });

      expect(response.status).toBe(200);
      expect(mockSupabase.storage.from).toHaveBeenCalled();
    });
  });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, PUT, DELETE } from './route';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('/api/library/playlists', () => {
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

  describe('GET /api/library/playlists', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const req = new NextRequest('http://localhost:3000/api/library/playlists');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return user playlists', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPlaylists = [
        {
          id: 'playlist-1',
          title: 'My Favorites',
          description: 'Best tracks',
          user_id: 'user-123',
          is_public: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          track_count: 5,
        },
        {
          id: 'playlist-2',
          title: 'Workout Mix',
          description: 'High energy',
          user_id: 'user-123',
          is_public: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          track_count: 10,
        },
      ];

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockPlaylists, error: null }),
      };
      
      mockSupabase.from.mockReturnValue(query);

      const req = new NextRequest('http://localhost:3000/api/library/playlists');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.playlists).toHaveLength(2);
      expect(query.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should include track details when requested', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPlaylists = [
        {
          id: 'playlist-1',
          title: 'My Favorites',
          user_id: 'user-123',
          playlist_tracks: [
            {
              position: 0,
              tracks: {
                id: 'track-1',
                title: 'Track 1',
                artist: 'Artist 1',
                duration: 180,
              },
            },
            {
              position: 1,
              tracks: {
                id: 'track-2',
                title: 'Track 2',
                artist: 'Artist 2',
                duration: 200,
              },
            },
          ],
        },
      ];

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const query = {
        select: vi.fn((fields: string) => {
          expect(fields).toContain('playlist_tracks');
          return query;
        }),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockPlaylists, error: null }),
      };
      
      mockSupabase.from.mockReturnValue(query);

      const req = new NextRequest('http://localhost:3000/api/library/playlists?includeTracks=true');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.playlists[0].tracks).toHaveLength(2);
    });
  });

  describe('POST /api/library/playlists', () => {
    it('should create a new playlist', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const newPlaylist = {
        title: 'New Playlist',
        description: 'A fresh playlist',
        is_public: false,
      };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'playlist-new', ...newPlaylist, user_id: 'user-123' },
          error: null,
        }),
      };
      
      mockSupabase.from.mockReturnValue(insertQuery);

      const req = new NextRequest('http://localhost:3000/api/library/playlists', {
        method: 'POST',
        body: JSON.stringify(newPlaylist),
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.playlist.title).toBe('New Playlist');
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Playlist',
          description: 'A fresh playlist',
          is_public: false,
          user_id: 'user-123',
        })
      );
    });

    it('should validate playlist title', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const req = new NextRequest('http://localhost:3000/api/library/playlists', {
        method: 'POST',
        body: JSON.stringify({ title: '', description: 'Empty title' }),
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid');
    });

    it('should handle duplicate playlist names', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Duplicate key' },
        }),
      };
      
      mockSupabase.from.mockReturnValue(insertQuery);

      const req = new NextRequest('http://localhost:3000/api/library/playlists', {
        method: 'POST',
        body: JSON.stringify({ title: 'Existing Playlist' }),
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });
  });

  describe('PUT /api/library/playlists', () => {
    it('should update playlist details', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const updates = {
        id: 'playlist-1',
        title: 'Updated Title',
        description: 'Updated description',
      };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...updates, user_id: 'user-123' },
          error: null,
        }),
      };
      
      mockSupabase.from.mockReturnValue(updateQuery);

      const req = new NextRequest('http://localhost:3000/api/library/playlists', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      
      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.playlist.title).toBe('Updated Title');
      expect(updateQuery.eq).toHaveBeenCalledWith('id', 'playlist-1');
      expect(updateQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should not allow updating other users playlists', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      
      mockSupabase.from.mockReturnValue(updateQuery);

      const req = new NextRequest('http://localhost:3000/api/library/playlists', {
        method: 'PUT',
        body: JSON.stringify({ id: 'playlist-other', title: 'Hacked' }),
      });
      
      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Playlist not found');
    });
  });

  describe('DELETE /api/library/playlists', () => {
    it('should delete a playlist', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const deleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'playlist-1', title: 'Deleted Playlist' },
          error: null,
        }),
      };
      
      mockSupabase.from.mockReturnValue(deleteQuery);

      const req = new NextRequest('http://localhost:3000/api/library/playlists?id=playlist-1', {
        method: 'DELETE',
      });
      
      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Playlist deleted successfully');
      expect(deleteQuery.eq).toHaveBeenCalledWith('id', 'playlist-1');
      expect(deleteQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should not allow deleting other users playlists', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      const deleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      
      mockSupabase.from.mockReturnValue(deleteQuery);

      const req = new NextRequest('http://localhost:3000/api/library/playlists?id=playlist-other', {
        method: 'DELETE',
      });
      
      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Playlist not found');
    });
  });
});
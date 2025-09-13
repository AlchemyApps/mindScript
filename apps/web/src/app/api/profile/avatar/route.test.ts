import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, DELETE } from './route';

// Mock sharp
vi.mock('sharp', () => {
  return {
    default: vi.fn(() => ({
      resize: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image'))
    }))
  };
});

// Mock the auth module
vi.mock('@mindscript/auth/server', () => ({
  createServerClient: vi.fn()
}));

describe('Avatar API Routes', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      auth: {
        getUser: vi.fn()
      },
      from: vi.fn(),
      storage: {
        from: vi.fn()
      }
    };

    const { createServerClient } = require('@mindscript/auth/server');
    createServerClient.mockResolvedValue(mockSupabase);
  });

  describe('POST /api/profile/avatar', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'POST'
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when no file is provided', async () => {
      const mockUser = { id: 'user-123' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const formData = new FormData();
      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'POST'
      });
      
      request.formData = vi.fn().mockResolvedValue(formData);
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No file provided');
    });

    it('should reject invalid file types', async () => {
      const mockUser = { id: 'user-123' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'POST'
      });
      
      request.formData = vi.fn().mockResolvedValue(formData);
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid file type');
    });

    it('should reject files exceeding size limit', async () => {
      const mockUser = { id: 'user-123' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Create a file larger than 5MB
      const largeContent = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'POST'
      });
      
      request.formData = vi.fn().mockResolvedValue(formData);
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('File size exceeds 5MB limit');
    });

    it('should upload avatar successfully', async () => {
      const mockUser = { id: 'user-123' };
      const mockAvatarUrl = 'https://storage.example.com/avatars/user-123/12345.webp';
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock profile query for existing avatar
      const mockProfileQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { avatar_url: null },
          error: null
        })
      };

      // Mock profile update
      const mockUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles' && !mockUpdateQuery.update.mock.calls.length) {
          return mockProfileQuery;
        }
        return mockUpdateQuery;
      });

      // Mock storage operations
      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: { path: 'user-123/12345.webp' },
          error: null
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: mockAvatarUrl }
        }),
        remove: vi.fn()
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      const file = new File(['image-content'], 'avatar.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'POST'
      });
      
      request.formData = vi.fn().mockResolvedValue(formData);
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.avatar_url).toBe(mockAvatarUrl);
      expect(data.message).toBe('Avatar uploaded successfully');
    });
  });

  describe('DELETE /api/profile/avatar', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'DELETE'
      });
      
      const response = await DELETE(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when no avatar exists', async () => {
      const mockUser = { id: 'user-123' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { avatar_url: null },
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'DELETE'
      });
      
      const response = await DELETE(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No avatar to delete');
    });

    it('should delete avatar successfully', async () => {
      const mockUser = { id: 'user-123' };
      const mockAvatarUrl = 'https://storage.example.com/avatars/user-123/12345.webp';
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock profile query
      const mockProfileQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { avatar_url: mockAvatarUrl },
          error: null
        })
      };

      // Mock profile update
      const mockUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      mockSupabase.from.mockImplementation(() => {
        if (!mockUpdateQuery.update.mock.calls.length) {
          return mockProfileQuery;
        }
        return mockUpdateQuery;
      });

      // Mock storage delete
      const mockStorageBucket = {
        remove: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      const request = new NextRequest('http://localhost:3000/api/profile/avatar', {
        method: 'DELETE'
      });
      
      const response = await DELETE(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Avatar deleted successfully');
      expect(mockStorageBucket.remove).toHaveBeenCalledWith(['user-123/12345.webp']);
    });
  });
});
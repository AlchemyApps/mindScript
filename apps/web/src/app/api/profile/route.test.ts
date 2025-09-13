import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from './route';

// Mock the auth module
vi.mock('@mindscript/auth/server', () => ({
  createServerClient: vi.fn()
}));

// Mock the schemas
vi.mock('@mindscript/schemas', () => ({
  profileSchema: {
    parse: vi.fn((data) => data)
  },
  profileUpdateSchema: {
    parse: vi.fn((data) => data)
  }
}));

describe('Profile API Routes', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      auth: {
        getUser: vi.fn()
      },
      from: vi.fn()
    };

    const { createServerClient } = require('@mindscript/auth/server');
    createServerClient.mockResolvedValue(mockSupabase);
  });

  describe('GET /api/profile', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const request = new NextRequest('http://localhost:3000/api/profile');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return profile data for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        user_preferences: [{
          theme: 'dark',
          notification_settings: { email_updates: true },
          privacy_settings: { profile_visible: true }
        }]
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/profile');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe('test@example.com');
      expect(data.display_name).toBe('Test User');
      expect(data.theme).toBe('dark');
      expect(data.user_preferences).toBeUndefined();
    });

    it('should return 404 when profile is not found', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Profile not found')
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/profile');
      const response = await GET(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Profile not found');
    });
  });

  describe('PUT /api/profile', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'New Name' })
      });
      
      const response = await PUT(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should update profile successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const updateData = {
        display_name: 'Updated Name',
        bio: 'Updated bio',
        theme: 'light'
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      const mockUpsertQuery = {
        upsert: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            ...mockUser,
            ...updateData,
            user_preferences: [{
              theme: 'light'
            }]
          },
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return mockUpdateQuery;
        } else if (table === 'user_preferences') {
          return mockUpsertQuery;
        }
        return mockSelectQuery;
      });

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      // Mock request.json()
      request.json = vi.fn().mockResolvedValue(updateData);
      
      const response = await PUT(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.display_name).toBe('Updated Name');
    });

    it('should handle validation errors', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const { profileUpdateSchema } = require('@mindscript/schemas');
      profileUpdateSchema.parse.mockImplementation(() => {
        throw {
          name: 'ZodError',
          errors: [{ message: 'Invalid input' }]
        };
      });

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      request.json = vi.fn().mockResolvedValue({ invalid: 'data' });
      
      const response = await PUT(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });
  });
});
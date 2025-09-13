import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the auth module
vi.mock('@mindscript/auth/server', () => ({
  createServerClient: vi.fn()
}));

// Mock the schemas
vi.mock('@mindscript/schemas', () => ({
  accountDeletionRequestSchema: {
    parse: vi.fn((data) => data)
  }
}));

describe('Account Deletion API Route', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        admin: {
          deleteUser: vi.fn()
        }
      },
      from: vi.fn(),
      storage: {
        from: vi.fn()
      }
    };

    const { createServerClient } = require('@mindscript/auth/server');
    createServerClient.mockResolvedValue(mockSupabase);
  });

  describe('POST /api/profile/delete-account', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const request = new NextRequest('http://localhost:3000/api/profile/delete-account', {
        method: 'POST'
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when password is incorrect', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        error: new Error('Invalid password')
      });

      const request = new NextRequest('http://localhost:3000/api/profile/delete-account', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({
        password: 'wrongpassword',
        confirm: true
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid password');
    });

    it('should prevent deletion with active subscriptions', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        error: null
      });

      // Mock subscriptions query
      const mockSubscriptionsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'sub-123' }], // Active subscription exists
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'subscriptions') {
          return mockSubscriptionsQuery;
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const request = new NextRequest('http://localhost:3000/api/profile/delete-account', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({
        password: 'correctpassword',
        confirm: true
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Please cancel all active subscriptions before deleting your account');
    });

    it('should prevent deletion with pending renders', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        error: null
      });

      // Mock queries
      const mockSubscriptionsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };

      const mockRendersQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'render-123' }], // Pending render exists
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'subscriptions') {
          return mockSubscriptionsQuery;
        } else if (table === 'audio_renders') {
          return mockRendersQuery;
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const request = new NextRequest('http://localhost:3000/api/profile/delete-account', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({
        password: 'correctpassword',
        confirm: true
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Please wait for all pending renders to complete before deleting your account');
    });

    it('should successfully delete account', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        error: null
      });

      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      });

      mockSupabase.auth.admin.deleteUser.mockResolvedValue({
        error: null
      });

      // Mock all queries
      const mockEmptyQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        }),
        single: vi.fn().mockResolvedValue({
          data: { avatar_url: 'https://example.com/avatar.jpg' },
          error: null
        })
      };

      const mockUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      const mockDeleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      const mockInsertQuery = {
        insert: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles' && mockUpdateQuery.update.mock.calls.length === 0) {
          return mockUpdateQuery;
        } else if (table === 'user_preferences' || table === 'seller_agreements') {
          return mockDeleteQuery;
        } else if (table === 'audit_logs') {
          return mockInsertQuery;
        }
        return mockEmptyQuery;
      });

      // Mock storage
      const mockStorageBucket = {
        remove: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      };

      mockSupabase.storage.from.mockReturnValue(mockStorageBucket);

      const request = new NextRequest('http://localhost:3000/api/profile/delete-account', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1'
        }
      });
      
      request.json = vi.fn().mockResolvedValue({
        password: 'correctpassword',
        reason: 'Testing deletion',
        confirm: true
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Account deleted successfully. We\'re sorry to see you go.');
      
      // Verify anonymization was called
      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Deleted User',
          username: null,
          bio: null,
          avatar_url: null
        })
      );
      
      // Verify user deletion was called
      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-123');
      
      // Verify sign out was called
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const { accountDeletionRequestSchema } = require('@mindscript/schemas');
      accountDeletionRequestSchema.parse.mockImplementation(() => {
        throw {
          name: 'ZodError',
          errors: [{ message: 'Confirmation required' }]
        };
      });

      const request = new NextRequest('http://localhost:3000/api/profile/delete-account', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({
        password: 'password',
        confirm: false
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });
  });
});
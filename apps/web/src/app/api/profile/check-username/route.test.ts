import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the auth module
vi.mock('@mindscript/auth/server', () => ({
  createServerClient: vi.fn()
}));

// Mock the schemas
vi.mock('@mindscript/schemas', () => ({
  usernameCheckSchema: {
    parse: vi.fn((data) => data)
  },
  validateUsername: vi.fn(),
  isUsernameReserved: vi.fn()
}));

describe('Username Check API Route', () => {
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

  describe('POST /api/profile/check-username', () => {
    it('should return unavailable for invalid username format', async () => {
      const { validateUsername } = require('@mindscript/schemas');
      validateUsername.mockReturnValue({
        valid: false,
        error: 'Username must start with a letter'
      });

      const request = new NextRequest('http://localhost:3000/api/profile/check-username', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({ username: '123invalid' });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.available).toBe(false);
      expect(data.error).toBe('Username must start with a letter');
    });

    it('should return unavailable for reserved usernames', async () => {
      const { validateUsername, isUsernameReserved } = require('@mindscript/schemas');
      validateUsername.mockReturnValue({ valid: true });
      isUsernameReserved.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/profile/check-username', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({ username: 'admin' });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.available).toBe(false);
      expect(data.error).toBe('This username is reserved');
    });

    it('should return available for valid, unreserved, unused username', async () => {
      const { validateUsername, isUsernameReserved } = require('@mindscript/schemas');
      validateUsername.mockReturnValue({ valid: true });
      isUsernameReserved.mockReturnValue(false);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/profile/check-username', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({ username: 'newuser' });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.available).toBe(true);
      expect(data.username).toBe('newuser');
      expect(data.error).toBe(null);
    });

    it('should return unavailable when username is taken by another user', async () => {
      const { validateUsername, isUsernameReserved } = require('@mindscript/schemas');
      validateUsername.mockReturnValue({ valid: true });
      isUsernameReserved.mockReturnValue(false);

      const mockUser = { id: 'user-123' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-456' }, // Different user owns this username
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/profile/check-username', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({ username: 'takenuser' });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.available).toBe(false);
      expect(data.error).toBe('Username is already taken');
    });

    it('should return available when username is owned by current user', async () => {
      const { validateUsername, isUsernameReserved } = require('@mindscript/schemas');
      validateUsername.mockReturnValue({ valid: true });
      isUsernameReserved.mockReturnValue(false);

      const mockUser = { id: 'user-123' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-123' }, // Same user owns this username
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost:3000/api/profile/check-username', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({ username: 'myusername' });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.available).toBe(true);
      expect(data.username).toBe('myusername');
    });

    it('should handle validation errors', async () => {
      const { usernameCheckSchema } = require('@mindscript/schemas');
      usernameCheckSchema.parse.mockImplementation(() => {
        throw {
          name: 'ZodError',
          errors: [{ message: 'Invalid username' }]
        };
      });

      const request = new NextRequest('http://localhost:3000/api/profile/check-username', {
        method: 'POST'
      });
      
      request.json = vi.fn().mockResolvedValue({ username: '' });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.available).toBe(false);
      expect(data.error).toBe('Invalid username format');
    });
  });
});
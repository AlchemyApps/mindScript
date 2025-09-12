import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession, getServerUser, requireAuth } from './session';

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

// Mock Supabase client
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}));

describe('Server Session Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getServerSession', () => {
    it('returns session when authenticated', async () => {
      const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        user: { id: 'user-123', email: 'test@example.com' },
      };

      const { createServerClient } = await import('@supabase/ssr');
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null,
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockClient as any);

      const session = await getServerSession();
      expect(session).toEqual(mockSession);
    });

    it('returns null when not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockClient as any);

      const session = await getServerSession();
      expect(session).toBeNull();
    });

    it('returns null on error', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: new Error('Auth error'),
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockClient as any);

      const session = await getServerSession();
      expect(session).toBeNull();
    });
  });

  describe('getServerUser', () => {
    it('returns user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01',
      };

      const { createServerClient } = await import('@supabase/ssr');
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockClient as any);

      const user = await getServerUser();
      expect(user).toEqual(mockUser);
    });

    it('returns null when not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockClient as any);

      const user = await getServerUser();
      expect(user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('returns session when authenticated', async () => {
      const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        user: { id: 'user-123', email: 'test@example.com' },
      };

      const { createServerClient } = await import('@supabase/ssr');
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null,
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockClient as any);

      const session = await requireAuth();
      expect(session).toEqual(mockSession);
    });

    it('throws error when not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      };
      vi.mocked(createServerClient).mockReturnValue(mockClient as any);

      await expect(requireAuth()).rejects.toThrow('Unauthorized');
    });
  });
});
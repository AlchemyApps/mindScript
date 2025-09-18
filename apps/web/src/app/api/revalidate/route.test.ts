import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock dependencies
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Revalidate API Route', () => {
  let mockSupabase: any;
  let revalidatePath: any;
  let revalidateTag: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked functions
    const cache = vi.mocked(await import('next/cache'));
    revalidatePath = cache.revalidatePath;
    revalidateTag = cache.revalidateTag;

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /api/revalidate', () => {
    it('should reject requests without authorization', async () => {
      const request = new NextRequest('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'path',
          path: '/u/johndoe',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid token', async () => {
      const request = new NextRequest('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token',
        },
        body: JSON.stringify({
          type: 'path',
          path: '/u/johndoe',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    describe('with valid authorization', () => {
      const validToken = process.env.REVALIDATION_TOKEN || 'test-token';

      it('should revalidate seller profile and all tracks', async () => {
        const { createClient } = await import('@/lib/supabase/server');

        mockSupabase.limit.mockResolvedValue({
          data: [
            { slug: 'track-1' },
            { slug: 'track-2' },
          ],
          error: null,
        });

        (createClient as any).mockResolvedValue(mockSupabase);

        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'seller',
            username: 'johndoe',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.revalidated).toContain('/u/johndoe');
        expect(data.revalidated).toContain('/u/johndoe/track-1');
        expect(data.revalidated).toContain('/u/johndoe/track-2');

        expect(revalidatePath).toHaveBeenCalledWith('/u/johndoe');
        expect(revalidatePath).toHaveBeenCalledWith('/u/johndoe/track-1');
        expect(revalidatePath).toHaveBeenCalledWith('/u/johndoe/track-2');
      });

      it('should revalidate specific track', async () => {
        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'track',
            username: 'johndoe',
            slug: 'meditation-track',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.revalidated).toEqual(['/u/johndoe/meditation-track']);

        expect(revalidatePath).toHaveBeenCalledWith('/u/johndoe/meditation-track');
        expect(revalidatePath).toHaveBeenCalledTimes(1);
      });

      it('should revalidate specific path', async () => {
        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'path',
            path: '/marketplace',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.revalidated).toEqual(['/marketplace']);

        expect(revalidatePath).toHaveBeenCalledWith('/marketplace');
      });

      it('should revalidate by tag', async () => {
        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'tag',
            tag: 'tracks',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.revalidated).toEqual(['tag:tracks']);

        expect(revalidateTag).toHaveBeenCalledWith('tracks');
      });

      it('should revalidate all main paths', async () => {
        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'all',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.revalidated).toContain('/');
        expect(data.revalidated).toContain('/marketplace');
        expect(data.revalidated).toContain('/sitemap.xml');

        expect(revalidatePath).toHaveBeenCalledWith('/');
        expect(revalidatePath).toHaveBeenCalledWith('/marketplace');
        expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
        expect(revalidateTag).toHaveBeenCalledWith('tracks');
        expect(revalidateTag).toHaveBeenCalledWith('sellers');
      });

      it('should handle missing required fields', async () => {
        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'seller',
            // missing username
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Username is required for seller revalidation');
      });

      it('should handle invalid revalidation type', async () => {
        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'invalid-type',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid revalidation type');
      });

      it('should handle database errors gracefully', async () => {
        const { createClient } = await import('@/lib/supabase/server');

        mockSupabase.limit.mockResolvedValue({
          data: null,
          error: new Error('Database connection failed'),
        });

        (createClient as any).mockResolvedValue(mockSupabase);

        const request = new NextRequest('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            type: 'seller',
            username: 'johndoe',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.revalidated).toContain('/u/johndoe');
        // Should still revalidate the main seller page even if tracks query fails
      });
    });
  });
});
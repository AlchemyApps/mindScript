import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient } from '../../../../../../test/mocks/supabase';

// Mock external dependencies
vi.mock('@/app/api/lib/render-utils', () => ({
  supabaseAdmin: createMockSupabaseClient(),
  verifyRenderOwnership: vi.fn(),
  getRenderJobStatus: vi.fn(),
  cancelRenderJob: vi.fn(),
}));

vi.mock('@/app/api/lib/rate-limit', () => ({
  createUserRateLimit: vi.fn(() => () => ({
    allowed: true,
    remaining: 9,
    resetTime: Date.now() + 60000,
    totalHits: 1,
  })),
  RATE_LIMITS: {
    cancel: { windowMs: 60000, max: 10 }
  }
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => createMockSupabaseClient())
}));

// Import mocked functions
import {
  verifyRenderOwnership,
  getRenderJobStatus,
  cancelRenderJob,
} from '../../../../lib/render-utils';
import { createUserRateLimit } from '../../../../lib/rate-limit';

describe('POST /api/renders/[id]/cancel', () => {
  const mockUserId = 'user-123';
  const mockRenderId = 'render-456';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(verifyRenderOwnership).mockResolvedValue(true);
    vi.mocked(getRenderJobStatus).mockResolvedValue({
      id: mockRenderId,
      track_id: 'track-123',
      user_id: mockUserId,
      status: 'pending',
      progress: 0,
      stage: null,
      job_data: { quality: 'standard', format: 'mp3' },
      result: null,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.mocked(cancelRenderJob).mockResolvedValue({
      id: mockRenderId,
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    });
  });

  it('should cancel render job successfully', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'User requested cancellation',
      }),
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

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Render job cancelled successfully');
    expect(data.render.status).toBe('cancelled');
    
    expect(verifyRenderOwnership).toHaveBeenCalledWith(mockRenderId, mockUserId);
    expect(getRenderJobStatus).toHaveBeenCalledWith(mockRenderId);
    expect(cancelRenderJob).toHaveBeenCalledWith(mockRenderId);
  });

  it('should cancel without reason', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });

    expect(response.status).toBe(200);
    expect(cancelRenderJob).toHaveBeenCalledWith(mockRenderId);
  });

  it('should return 401 when user is not authenticated', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Mock no auth
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) }
      })
    }));

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 403 when user does not own the render', async () => {
    vi.mocked(verifyRenderOwnership).mockResolvedValue(false);

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not own this render job');
  });

  it('should return 404 when render job not found', async () => {
    vi.mocked(getRenderJobStatus).mockRejectedValue(new Error('Job not found'));

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Render job not found');
  });

  it('should return 409 when render job cannot be cancelled (completed)', async () => {
    vi.mocked(getRenderJobStatus).mockResolvedValue({
      id: mockRenderId,
      status: 'completed',
      progress: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Cannot cancel render job with status: completed');
  });

  it('should return 409 when render job cannot be cancelled (failed)', async () => {
    vi.mocked(getRenderJobStatus).mockResolvedValue({
      id: mockRenderId,
      status: 'failed',
      progress: 25,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Cannot cancel render job with status: failed');
  });

  it('should return 409 when render job already cancelled', async () => {
    vi.mocked(getRenderJobStatus).mockResolvedValue({
      id: mockRenderId,
      status: 'cancelled',
      progress: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Cannot cancel render job with status: cancelled');
  });

  it('should allow cancelling processing job', async () => {
    vi.mocked(getRenderJobStatus).mockResolvedValue({
      id: mockRenderId,
      status: 'processing',
      progress: 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });

    expect(response.status).toBe(200);
    expect(cancelRenderJob).toHaveBeenCalledWith(mockRenderId);
  });

  it('should return 429 when rate limit exceeded', async () => {
    // Mock rate limit exceeded
    vi.mocked(createUserRateLimit).mockReturnValue(() => ({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      totalHits: 11,
    }));

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded');
    expect(response.headers.get('x-ratelimit-limit')).toBe('10');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('should return 400 for invalid render ID format', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders/invalid-id/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: 'invalid-id' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid render ID format');
  });

  it('should validate reason length', async () => {
    const longReason = 'x'.repeat(256); // Exceeds max length

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: longReason }),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Validation error');
  });

  it('should handle cancel operation failure', async () => {
    vi.mocked(cancelRenderJob).mockRejectedValue(new Error('DB error'));

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to cancel render job');
  });

  it('should handle malformed JSON gracefully', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{',
    });

    const response = await POST(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON in request body');
  });
});
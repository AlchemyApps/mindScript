import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient } from '../../../../../test/mocks/supabase';

// Mock external dependencies
vi.mock('@/app/api/lib/render-utils', () => ({
  supabaseAdmin: createMockSupabaseClient(),
  verifyTrackOwnership: vi.fn(),
  getExistingRenderJob: vi.fn(),
  createRenderJob: vi.fn(),
  invokeRenderProcessor: vi.fn(),
}));

vi.mock('@/app/api/lib/rate-limit', () => ({
  createUserRateLimit: vi.fn(() => () => ({
    allowed: true,
    remaining: 4,
    resetTime: Date.now() + 3600000,
    totalHits: 1,
  })),
  RATE_LIMITS: {
    render: { windowMs: 3600000, max: 5 }
  }
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => createMockSupabaseClient())
}));

// Import mocked functions
import {
  verifyTrackOwnership,
  getExistingRenderJob,
  createRenderJob,
  invokeRenderProcessor,
} from '../../../lib/render-utils';
import { createUserRateLimit } from '../../../lib/rate-limit';

describe('POST /api/tracks/[id]/render', () => {
  const mockUserId = 'user-123';
  const mockTrackId = 'track-456';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(verifyTrackOwnership).mockResolvedValue(true);
    vi.mocked(getExistingRenderJob).mockResolvedValue(null);
    vi.mocked(createRenderJob).mockResolvedValue({
      id: 'job-123',
      track_id: mockTrackId,
      user_id: mockUserId,
      status: 'pending',
      progress: 0,
      created_at: new Date().toISOString(),
    });
    vi.mocked(invokeRenderProcessor).mockResolvedValue({ success: true });
  });

  it('should create render job successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quality: 'standard',
        format: 'mp3',
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

    const response = await POST(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.render.id).toBe('job-123');
    expect(data.render.status).toBe('pending');
    
    expect(verifyTrackOwnership).toHaveBeenCalledWith(mockTrackId, mockUserId);
    expect(getExistingRenderJob).toHaveBeenCalledWith(mockTrackId, mockUserId);
    expect(createRenderJob).toHaveBeenCalled();
    expect(invokeRenderProcessor).toHaveBeenCalledWith('job-123');
  });

  it('should return 401 when user is not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'standard', format: 'mp3' }),
    });

    // Mock no auth
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) }
      })
    }));

    const response = await POST(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 403 when user does not own the track', async () => {
    vi.mocked(verifyTrackOwnership).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'standard', format: 'mp3' }),
    });

    const response = await POST(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not own this track');
  });

  it('should return 409 when render job already exists', async () => {
    const existingJob = {
      id: 'existing-job-123',
      status: 'processing',
      progress: 50,
      created_at: new Date().toISOString(),
    };
    vi.mocked(getExistingRenderJob).mockResolvedValue(existingJob);

    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'standard', format: 'mp3' }),
    });

    const response = await POST(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Render job already in progress');
    expect(data.existing_render.id).toBe('existing-job-123');
  });

  it('should return 429 when rate limit exceeded', async () => {
    // Mock rate limit exceeded
    vi.mocked(createUserRateLimit).mockReturnValue(() => ({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 3600000,
      totalHits: 6,
    }));

    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'standard', format: 'mp3' }),
    });

    const response = await POST(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded');
    expect(response.headers.get('x-ratelimit-limit')).toBe('5');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('should validate request body and return 400 for invalid input', async () => {
    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quality: 'invalid',
        format: 'invalid',
      }),
    });

    const response = await POST(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Validation error');
  });

  it('should handle missing track gracefully', async () => {
    vi.mocked(verifyTrackOwnership).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/tracks/nonexistent/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'standard', format: 'mp3' }),
    });

    const response = await POST(request, { params: { id: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not own this track');
  });

  it('should handle render processor invocation failure', async () => {
    vi.mocked(invokeRenderProcessor).mockRejectedValue(new Error('Processor failed'));

    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality: 'standard', format: 'mp3' }),
    });

    const response = await POST(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to start render job');
  });

  it('should use default values when optional fields are missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/tracks/track-456/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // Empty body, should use defaults
    });

    const response = await POST(request, { params: { id: mockTrackId } });

    expect(response.status).toBe(201);
    expect(createRenderJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobData: expect.objectContaining({
          quality: 'standard',
          format: 'mp3',
        })
      })
    );
  });
});
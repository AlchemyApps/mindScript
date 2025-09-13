import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient } from '../../../../../../test/mocks/supabase';

// Mock external dependencies
vi.mock('@/app/api/lib/render-utils', () => ({
  supabaseAdmin: createMockSupabaseClient(),
  verifyRenderOwnership: vi.fn(),
  getRenderJobStatus: vi.fn(),
}));

vi.mock('@/app/api/lib/rate-limit', () => ({
  createUserRateLimit: vi.fn(() => () => ({
    allowed: true,
    remaining: 59,
    resetTime: Date.now() + 60000,
    totalHits: 1,
  })),
  RATE_LIMITS: {
    status: { windowMs: 60000, max: 60 }
  }
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => createMockSupabaseClient())
}));

// Import mocked functions
import {
  verifyRenderOwnership,
  getRenderJobStatus,
} from '../../../../lib/render-utils';
import { createUserRateLimit } from '../../../../lib/rate-limit';

describe('GET /api/renders/[id]/status', () => {
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
      status: 'processing',
      progress: 75,
      stage: 'Mixing audio layers',
      job_data: { quality: 'standard', format: 'mp3' },
      result: null,
      error: null,
      created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
      updated_at: new Date('2024-01-01T00:05:00Z').toISOString(),
    });
  });

  it('should return render job status successfully', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
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

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(mockRenderId);
    expect(data.status).toBe('processing');
    expect(data.progress).toBe(75);
    expect(data.stage).toBe('Mixing audio layers');
    expect(data.created_at).toBe('2024-01-01T00:00:00.000Z');
    expect(data.updated_at).toBe('2024-01-01T00:05:00.000Z');
    
    expect(verifyRenderOwnership).toHaveBeenCalledWith(mockRenderId, mockUserId);
    expect(getRenderJobStatus).toHaveBeenCalledWith(mockRenderId);
  });

  it('should return completed render with result', async () => {
    const completedJob = {
      id: mockRenderId,
      track_id: 'track-123',
      user_id: mockUserId,
      status: 'completed',
      progress: 100,
      stage: 'Upload complete',
      job_data: { quality: 'high', format: 'wav' },
      result: {
        audio_url: 'https://example.com/audio.wav',
        duration_seconds: 300,
        file_size_bytes: 1024000,
      },
      error: null,
      created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
      updated_at: new Date('2024-01-01T00:10:00Z').toISOString(),
    };
    vi.mocked(getRenderJobStatus).mockResolvedValue(completedJob);

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('completed');
    expect(data.progress).toBe(100);
    expect(data.result).toEqual({
      audio_url: 'https://example.com/audio.wav',
      duration_seconds: 300,
      file_size_bytes: 1024000,
    });
  });

  it('should return failed render with error', async () => {
    const failedJob = {
      id: mockRenderId,
      track_id: 'track-123',
      user_id: mockUserId,
      status: 'failed',
      progress: 50,
      stage: 'TTS generation',
      job_data: { quality: 'standard', format: 'mp3' },
      result: null,
      error: 'TTS service unavailable',
      created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
      updated_at: new Date('2024-01-01T00:03:00Z').toISOString(),
    };
    vi.mocked(getRenderJobStatus).mockResolvedValue(failedJob);

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('failed');
    expect(data.progress).toBe(50);
    expect(data.error).toBe('TTS service unavailable');
  });

  it('should return 401 when user is not authenticated', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    // Mock no auth
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) }
      })
    }));

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 403 when user does not own the render', async () => {
    vi.mocked(verifyRenderOwnership).mockResolvedValue(false);

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not own this render job');
  });

  it('should return 404 when render job not found', async () => {
    vi.mocked(getRenderJobStatus).mockRejectedValue(new Error('Job not found'));

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Render job not found');
  });

  it('should return 429 when rate limit exceeded', async () => {
    // Mock rate limit exceeded
    vi.mocked(createUserRateLimit).mockReturnValue(() => ({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      totalHits: 61,
    }));

    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded');
    expect(response.headers.get('x-ratelimit-limit')).toBe('60');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('should return 400 for invalid render ID format', async () => {
    const request = new NextRequest('http://localhost:3000/api/renders/invalid-id/status', {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: 'invalid-id' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid render ID format');
  });

  it('should include cache headers for poll-friendly responses', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockRenderId } });

    // Check cache headers for polling
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('x-ratelimit-limit')).toBe('60');
  });

  it('should transform timestamps to ISO format', async () => {
    const request = new NextRequest(`http://localhost:3000/api/renders/${mockRenderId}/status`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockRenderId } });
    const data = await response.json();

    expect(data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(data.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
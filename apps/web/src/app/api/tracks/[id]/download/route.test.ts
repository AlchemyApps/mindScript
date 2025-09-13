import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient } from '../../../../../test/mocks/supabase';

// Mock external dependencies
vi.mock('@/app/api/lib/render-utils', () => ({
  supabaseAdmin: createMockSupabaseClient(),
  verifyTrackOwnership: vi.fn(),
  getTrackDownloadInfo: vi.fn(),
  generateDownloadUrl: vi.fn(),
  incrementDownloadCount: vi.fn(),
}));

vi.mock('@/app/api/lib/rate-limit', () => ({
  createUserRateLimit: vi.fn(() => () => ({
    allowed: true,
    remaining: 49,
    resetTime: Date.now() + 300000,
    totalHits: 1,
  })),
  RATE_LIMITS: {
    download: { windowMs: 300000, max: 50 }
  }
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => createMockSupabaseClient())
}));

// Import mocked functions
import {
  verifyTrackOwnership,
  getTrackDownloadInfo,
  generateDownloadUrl,
  incrementDownloadCount,
} from '../../../lib/render-utils';
import { createUserRateLimit } from '../../../lib/rate-limit';

describe('GET /api/tracks/[id]/download', () => {
  const mockUserId = 'user-123';
  const mockTrackId = 'track-456';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(verifyTrackOwnership).mockResolvedValue(true);
    vi.mocked(getTrackDownloadInfo).mockResolvedValue({
      audio_url: 'tracks/completed/track-456.mp3',
      status: 'published',
    });
    vi.mocked(generateDownloadUrl).mockResolvedValue(
      'https://example.supabase.co/storage/v1/object/sign/audio-tracks/track-456.mp3?token=abc123'
    );
    vi.mocked(incrementDownloadCount).mockResolvedValue(undefined);
  });

  it('should generate download URL successfully', async () => {
    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
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

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.download_url).toBe('https://example.supabase.co/storage/v1/object/sign/audio-tracks/track-456.mp3?token=abc123');
    expect(data.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    expect(verifyTrackOwnership).toHaveBeenCalledWith(mockTrackId, mockUserId);
    expect(getTrackDownloadInfo).toHaveBeenCalledWith(mockTrackId);
    expect(generateDownloadUrl).toHaveBeenCalledWith('tracks/completed/track-456.mp3', 3600);
    expect(incrementDownloadCount).toHaveBeenCalledWith(mockTrackId);
  });

  it('should use custom expiry when provided', async () => {
    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download?expires_in=1800`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });

    expect(response.status).toBe(200);
    expect(generateDownloadUrl).toHaveBeenCalledWith('tracks/completed/track-456.mp3', 1800);
  });

  it('should return 401 when user is not authenticated', async () => {
    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    // Mock no auth
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) }
      })
    }));

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 403 when user does not own the track', async () => {
    vi.mocked(verifyTrackOwnership).mockResolvedValue(false);

    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not own this track');
  });

  it('should return 404 when track audio is not available', async () => {
    vi.mocked(getTrackDownloadInfo).mockResolvedValue({
      audio_url: null,
      status: 'draft',
    });

    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Audio file not available');
  });

  it('should return 404 when track is not completed', async () => {
    vi.mocked(getTrackDownloadInfo).mockResolvedValue({
      audio_url: 'tracks/pending/track-456.mp3',
      status: 'draft',
    });

    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Audio file not available');
  });

  it('should return 429 when rate limit exceeded', async () => {
    // Mock rate limit exceeded
    vi.mocked(createUserRateLimit).mockReturnValue(() => ({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 300000,
      totalHits: 51,
    }));

    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded');
    expect(response.headers.get('x-ratelimit-limit')).toBe('50');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('should return 400 for invalid track ID format', async () => {
    const request = new NextRequest('http://localhost:3000/api/tracks/invalid-id/download', {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: 'invalid-id' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid track ID format');
  });

  it('should validate expires_in parameter', async () => {
    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download?expires_in=100`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Validation error');
  });

  it('should handle signed URL generation failure', async () => {
    vi.mocked(generateDownloadUrl).mockRejectedValue(new Error('Storage error'));

    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate download URL');
  });

  it('should increment download count even if non-critical', async () => {
    // Mock increment failure (should not affect download)
    vi.mocked(incrementDownloadCount).mockRejectedValue(new Error('DB error'));

    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });

    expect(response.status).toBe(200); // Still succeeds
    expect(incrementDownloadCount).toHaveBeenCalledWith(mockTrackId);
  });

  it('should include range request support headers', async () => {
    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });

    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-type')).toBe('application/json');
  });

  it('should handle missing expires_in gracefully', async () => {
    const request = new NextRequest(`http://localhost:3000/api/tracks/${mockTrackId}/download`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { id: mockTrackId } });

    expect(response.status).toBe(200);
    expect(generateDownloadUrl).toHaveBeenCalledWith('tracks/completed/track-456.mp3', 3600); // Default
  });
});
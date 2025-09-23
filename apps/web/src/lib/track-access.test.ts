import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkTrackAccess,
  generateSignedUrl,
  batchCheckTrackAccess,
  grantTrackAccess
} from './track-access';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

// Mock createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('Track Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkTrackAccess', () => {
    it('should grant access to track owner', async () => {
      const trackId = 'track-123';
      const userId = 'user-123';
      const mockTrack = {
        id: trackId,
        user_id: userId,
        title: 'Test Track',
        audio_url: 'tracks-private/user-123/track-123/audio.mp3'
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTrack,
              error: null
            }),
          }),
        }),
      });

      const result = await checkTrackAccess(trackId, userId);

      expect(result.hasAccess).toBe(true);
      expect(result.accessType).toBe('owner');
      expect(result.track).toEqual(mockTrack);
    });

    it('should grant access to track purchaser', async () => {
      const trackId = 'track-123';
      const userId = 'user-456';
      const ownerId = 'user-789';
      const mockTrack = {
        id: trackId,
        user_id: ownerId,
        title: 'Test Track',
        audio_url: 'tracks-private/user-789/track-123/audio.mp3'
      };

      // First call returns track (not owned by user)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTrack,
              error: null
            }),
          }),
        }),
      });

      // Second call returns purchase access
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { track_id: trackId, user_id: userId, access_type: 'purchase' },
                  error: null
                }),
              }),
            }),
          }),
        }),
      });

      const result = await checkTrackAccess(trackId, userId);

      expect(result.hasAccess).toBe(true);
      expect(result.accessType).toBe('purchased');
      expect(result.track).toEqual(mockTrack);
    });

    it('should deny access to unauthorized user', async () => {
      const trackId = 'track-123';
      const userId = 'user-456';
      const ownerId = 'user-789';
      const mockTrack = {
        id: trackId,
        user_id: ownerId,
        title: 'Test Track'
      };

      // First call returns track (not owned by user)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTrack,
              error: null
            }),
          }),
        }),
      });

      // Second call returns no purchase access
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'No rows found' }
                }),
              }),
            }),
          }),
        }),
      });

      const result = await checkTrackAccess(trackId, userId);

      expect(result.hasAccess).toBe(false);
      expect(result.accessType).toBe('none');
      expect(result.track).toBeNull();
    });

    it('should handle track not found', async () => {
      const trackId = 'non-existent';
      const userId = 'user-123';

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            }),
          }),
        }),
      });

      const result = await checkTrackAccess(trackId, userId);

      expect(result.hasAccess).toBe(false);
      expect(result.accessType).toBe('none');
      expect(result.track).toBeNull();
    });
  });

  describe('generateSignedUrl', () => {
    it('should generate signed URL successfully', async () => {
      const audioUrl = 'tracks-private/user-123/track-123/audio.mp3';
      const mockSignedUrl = 'https://storage.example.com/signed-url-123';

      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: mockSignedUrl },
          error: null,
        }),
      });

      const result = await generateSignedUrl(audioUrl, 3600);

      expect(result.signedUrl).toBe(mockSignedUrl);
      expect(result.error).toBeNull();
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('tracks-private');
    });

    it('should handle signed URL generation error', async () => {
      const audioUrl = 'tracks-private/user-123/track-123/audio.mp3';

      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Storage error'),
        }),
      });

      const result = await generateSignedUrl(audioUrl, 3600);

      expect(result.signedUrl).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('batchCheckTrackAccess', () => {
    it('should check access for multiple tracks', async () => {
      const trackIds = ['track-1', 'track-2', 'track-3'];
      const userId = 'user-123';

      // Mock tracks query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 'track-1', user_id: userId }, // Owned
              { id: 'track-2', user_id: 'other-user' }, // Not owned
              { id: 'track-3', user_id: 'other-user' }, // Not owned
            ],
            error: null,
          }),
        }),
      });

      // Mock purchases query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { track_id: 'track-2' }, // Purchased
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const accessMap = await batchCheckTrackAccess(trackIds, userId);

      expect(accessMap.get('track-1')).toBe(true); // Owned
      expect(accessMap.get('track-2')).toBe(true); // Purchased
      expect(accessMap.get('track-3')).toBe(false); // No access
    });
  });

  describe('grantTrackAccess', () => {
    it('should grant track access successfully', async () => {
      const trackId = 'track-123';
      const userId = 'user-456';
      const purchaseId = 'purchase-789';

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      const result = await grantTrackAccess(trackId, userId, 'purchase', purchaseId);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('track_access');
    });

    it('should handle grant access error', async () => {
      const trackId = 'track-123';
      const userId = 'user-456';

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: new Error('Database error'),
        }),
      });

      const result = await grantTrackAccess(trackId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });
});
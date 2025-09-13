import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyTrackOwnership,
  verifyRenderOwnership,
  getExistingRenderJob,
  createRenderJob,
  getRenderJobStatus,
  cancelRenderJob,
  generateDownloadUrl,
  getTrackDownloadInfo,
  incrementDownloadCount,
  invokeRenderProcessor,
} from './render-utils';
import { createMockSupabaseClient } from '../../../test/mocks/supabase';

// Mock Supabase client
const mockSupabaseAdmin = createMockSupabaseClient();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseAdmin),
}));

describe('render-utils', () => {
  const mockUserId = 'user-123';
  const mockTrackId = 'track-456';
  const mockRenderId = 'render-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyTrackOwnership', () => {
    it('should return true when user owns the track', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: mockUserId },
              error: null,
            }),
          }),
        }),
      });

      const result = await verifyTrackOwnership(mockTrackId, mockUserId);

      expect(result).toBe(true);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('tracks');
    });

    it('should return false when user does not own the track', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'other-user' },
              error: null,
            }),
          }),
        }),
      });

      const result = await verifyTrackOwnership(mockTrackId, mockUserId);

      expect(result).toBe(false);
    });

    it('should return false when track is not found', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await verifyTrackOwnership(mockTrackId, mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('verifyRenderOwnership', () => {
    it('should return true when user owns the render job', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: mockUserId },
              error: null,
            }),
          }),
        }),
      });

      const result = await verifyRenderOwnership(mockRenderId, mockUserId);

      expect(result).toBe(true);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('audio_job_queue');
    });

    it('should return false when user does not own the render job', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'other-user' },
              error: null,
            }),
          }),
        }),
      });

      const result = await verifyRenderOwnership(mockRenderId, mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('getExistingRenderJob', () => {
    it('should return existing pending render job', async () => {
      const existingJob = {
        id: mockRenderId,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [existingJob],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getExistingRenderJob(mockTrackId, mockUserId);

      expect(result).toEqual(existingJob);
    });

    it('should return null when no existing job', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getExistingRenderJob(mockTrackId, mockUserId);

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' },
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      await expect(getExistingRenderJob(mockTrackId, mockUserId)).rejects.toThrow('Failed to check existing renders');
    });
  });

  describe('createRenderJob', () => {
    it('should create render job successfully', async () => {
      const jobData = { quality: 'standard', format: 'mp3' };
      const createdJob = {
        id: mockRenderId,
        track_id: mockTrackId,
        user_id: mockUserId,
        status: 'pending',
        progress: 0,
        job_data: jobData,
        created_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: createdJob,
              error: null,
            }),
          }),
        }),
      });

      const result = await createRenderJob({
        trackId: mockTrackId,
        userId: mockUserId,
        jobData,
      });

      expect(result).toEqual(createdJob);
    });

    it('should throw error on creation failure', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
      });

      await expect(
        createRenderJob({
          trackId: mockTrackId,
          userId: mockUserId,
          jobData: {},
        })
      ).rejects.toThrow('Failed to create render job');
    });
  });

  describe('getRenderJobStatus', () => {
    it('should return render job status', async () => {
      const jobStatus = {
        id: mockRenderId,
        status: 'processing',
        progress: 75,
        created_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: jobStatus,
              error: null,
            }),
          }),
        }),
      });

      const result = await getRenderJobStatus(mockRenderId);

      expect(result).toEqual(jobStatus);
    });

    it('should throw error when job not found', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      await expect(getRenderJobStatus(mockRenderId)).rejects.toThrow('Failed to get render status');
    });
  });

  describe('cancelRenderJob', () => {
    it('should cancel render job successfully', async () => {
      const cancelledJob = {
        id: mockRenderId,
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: cancelledJob,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await cancelRenderJob(mockRenderId);

      expect(result).toEqual(cancelledJob);
    });

    it('should throw error on cancellation failure', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Update failed' },
                }),
              }),
            }),
          }),
        }),
      });

      await expect(cancelRenderJob(mockRenderId)).rejects.toThrow('Failed to cancel render job');
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate signed URL successfully', async () => {
      const signedUrl = 'https://example.com/signed-url';
      
      mockSupabaseAdmin.storage = {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl },
            error: null,
          }),
        })),
      };

      const result = await generateDownloadUrl('path/to/audio.mp3', 3600);

      expect(result).toBe(signedUrl);
      expect(mockSupabaseAdmin.storage.from).toHaveBeenCalledWith('audio-tracks');
    });

    it('should throw error on URL generation failure', async () => {
      mockSupabaseAdmin.storage = {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Storage error' },
          }),
        })),
      };

      await expect(generateDownloadUrl('path/to/audio.mp3', 3600)).rejects.toThrow('Failed to generate download URL');
    });
  });

  describe('getTrackDownloadInfo', () => {
    it('should return track download info', async () => {
      const trackInfo = {
        audio_url: 'path/to/audio.mp3',
        status: 'published',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: trackInfo,
              error: null,
            }),
          }),
        }),
      });

      const result = await getTrackDownloadInfo(mockTrackId);

      expect(result).toEqual(trackInfo);
    });

    it('should throw error when track not found', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      await expect(getTrackDownloadInfo(mockTrackId)).rejects.toThrow('Failed to get track info');
    });
  });

  describe('incrementDownloadCount', () => {
    it('should call RPC function', async () => {
      mockSupabaseAdmin.rpc = vi.fn().mockResolvedValue({
        error: null,
      });

      await incrementDownloadCount(mockTrackId);

      expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('increment_download_count', {
        track_id: mockTrackId,
      });
    });

    it('should not throw error on RPC failure (non-critical)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockSupabaseAdmin.rpc = vi.fn().mockResolvedValue({
        error: { message: 'RPC error' },
      });

      await expect(incrementDownloadCount(mockTrackId)).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to increment download count:', { message: 'RPC error' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('invokeRenderProcessor', () => {
    it('should invoke Edge Function successfully', async () => {
      const jobId = 'job-123';
      const functionResult = { success: true };

      mockSupabaseAdmin.functions = {
        invoke: vi.fn().mockResolvedValue({
          data: functionResult,
          error: null,
        }),
      };

      const result = await invokeRenderProcessor(jobId);

      expect(result).toEqual(functionResult);
      expect(mockSupabaseAdmin.functions.invoke).toHaveBeenCalledWith('render-audio', {
        body: { jobId },
      });
    });

    it('should throw error on Edge Function failure', async () => {
      mockSupabaseAdmin.functions = {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Function error' },
        }),
      };

      await expect(invokeRenderProcessor('job-123')).rejects.toThrow('Failed to invoke render processor');
    });
  });
});
import { describe, it, expect } from 'vitest';
import {
  RenderRequestSchema,
  RenderStatusSchema,
  ListRendersSchema,
  CancelRenderSchema,
  DownloadOptionsSchema,
  RateLimitConfigSchema,
} from './render';

describe('render schemas', () => {
  describe('RenderRequestSchema', () => {
    it('should validate valid render request', () => {
      const validRequest = {
        quality: 'standard',
        format: 'mp3',
      };
      
      expect(() => RenderRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should use default values', () => {
      const result = RenderRequestSchema.parse({});
      
      expect(result.quality).toBe('standard');
      expect(result.format).toBe('mp3');
    });

    it('should reject invalid quality', () => {
      const invalidRequest = {
        quality: 'invalid',
        format: 'mp3',
      };
      
      expect(() => RenderRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid format', () => {
      const invalidRequest = {
        quality: 'standard',
        format: 'invalid',
      };
      
      expect(() => RenderRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('RenderStatusSchema', () => {
    it('should validate complete render status', () => {
      const validStatus = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        track_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'completed',
        progress: 100,
        result: {
          audio_url: 'https://example.com/audio.mp3',
          duration_seconds: 180,
          file_size_bytes: 1024000,
        },
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:05:00.000Z',
      };
      
      expect(() => RenderStatusSchema.parse(validStatus)).not.toThrow();
    });

    it('should validate processing status without result', () => {
      const processingStatus = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        track_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'processing',
        progress: 75,
        stage: 'Mixing audio layers',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:03:00.000Z',
      };
      
      expect(() => RenderStatusSchema.parse(processingStatus)).not.toThrow();
    });

    it('should validate failed status with error', () => {
      const failedStatus = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        track_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'failed',
        progress: 25,
        error: 'TTS service unavailable',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:02:00.000Z',
      };
      
      expect(() => RenderStatusSchema.parse(failedStatus)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      const invalidStatus = {
        id: 'invalid-uuid',
        track_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'completed',
        progress: 100,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:05:00.000Z',
      };
      
      expect(() => RenderStatusSchema.parse(invalidStatus)).toThrow();
    });

    it('should reject invalid status', () => {
      const invalidStatus = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        track_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'invalid',
        progress: 100,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:05:00.000Z',
      };
      
      expect(() => RenderStatusSchema.parse(invalidStatus)).toThrow();
    });

    it('should reject progress outside range', () => {
      const invalidStatus = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        track_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'processing',
        progress: 150, // Invalid, max is 100
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:03:00.000Z',
      };
      
      expect(() => RenderStatusSchema.parse(invalidStatus)).toThrow();
    });
  });

  describe('ListRendersSchema', () => {
    it('should validate with defaults', () => {
      const result = ListRendersSchema.parse({});
      
      expect(result.limit).toBe(20);
    });

    it('should validate with all parameters', () => {
      const validQuery = {
        cursor: '2024-01-01T00:00:00.000Z',
        limit: 10,
        status: 'completed',
        track_id: '550e8400-e29b-41d4-a716-446655440000',
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-01T23:59:59.000Z',
      };
      
      expect(() => ListRendersSchema.parse(validQuery)).not.toThrow();
    });

    it('should reject invalid limit', () => {
      const invalidQuery = {
        limit: 0, // Below minimum
      };
      
      expect(() => ListRendersSchema.parse(invalidQuery)).toThrow();
    });

    it('should reject limit above maximum', () => {
      const invalidQuery = {
        limit: 100, // Above maximum
      };
      
      expect(() => ListRendersSchema.parse(invalidQuery)).toThrow();
    });

    it('should reject invalid status', () => {
      const invalidQuery = {
        status: 'invalid',
      };
      
      expect(() => ListRendersSchema.parse(invalidQuery)).toThrow();
    });

    it('should reject invalid track_id', () => {
      const invalidQuery = {
        track_id: 'invalid-uuid',
      };
      
      expect(() => ListRendersSchema.parse(invalidQuery)).toThrow();
    });
  });

  describe('CancelRenderSchema', () => {
    it('should validate empty request', () => {
      expect(() => CancelRenderSchema.parse({})).not.toThrow();
    });

    it('should validate with reason', () => {
      const validCancel = {
        reason: 'User requested cancellation',
      };
      
      expect(() => CancelRenderSchema.parse(validCancel)).not.toThrow();
    });

    it('should reject reason that is too long', () => {
      const invalidCancel = {
        reason: 'x'.repeat(256), // Too long
      };
      
      expect(() => CancelRenderSchema.parse(invalidCancel)).toThrow();
    });
  });

  describe('DownloadOptionsSchema', () => {
    it('should use default expires_in', () => {
      const result = DownloadOptionsSchema.parse({});
      
      expect(result.expires_in).toBe(3600);
    });

    it('should validate custom expires_in', () => {
      const validOptions = {
        expires_in: 1800,
      };
      
      expect(() => DownloadOptionsSchema.parse(validOptions)).not.toThrow();
    });

    it('should reject expires_in below minimum', () => {
      const invalidOptions = {
        expires_in: 100, // Below minimum of 300
      };
      
      expect(() => DownloadOptionsSchema.parse(invalidOptions)).toThrow();
    });

    it('should reject expires_in above maximum', () => {
      const invalidOptions = {
        expires_in: 7200, // Above maximum of 3600
      };
      
      expect(() => DownloadOptionsSchema.parse(invalidOptions)).toThrow();
    });
  });

  describe('RateLimitConfigSchema', () => {
    it('should validate with defaults', () => {
      const result = RateLimitConfigSchema.parse({});
      
      expect(result.render.window_ms).toBe(60 * 60 * 1000); // 1 hour
      expect(result.render.max).toBe(5);
      expect(result.status.window_ms).toBe(60 * 1000); // 1 minute
      expect(result.status.max).toBe(60);
    });

    it('should validate custom configuration', () => {
      const validConfig = {
        render: {
          window_ms: 30 * 60 * 1000, // 30 minutes
          max: 3,
        },
        status: {
          window_ms: 30 * 1000, // 30 seconds
          max: 30,
        },
      };
      
      expect(() => RateLimitConfigSchema.parse(validConfig)).not.toThrow();
    });
  });
});
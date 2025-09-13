import { describe, it, expect } from 'vitest';
import { 
  CreateTrackSchema, 
  UpdateTrackSchema, 
  ListTracksSchema,
  TrackSchema,
  validateTrackConfig 
} from './track';

describe('Track Schemas', () => {
  describe('CreateTrackSchema', () => {
    it('should validate valid track data', () => {
      const validTrack = {
        title: 'Test Track',
        script: 'This is a test script for our track',
        voice_config: {
          provider: 'openai' as const,
          voice_id: 'alloy',
        },
        output_config: {
          format: 'mp3' as const,
          quality: 'standard' as const,
          is_public: false,
        },
      };

      const result = CreateTrackSchema.parse(validTrack);
      expect(result.title).toBe('Test Track');
      expect(result.voice_config.provider).toBe('openai');
    });

    it('should reject invalid title', () => {
      const invalidTrack = {
        title: '', // Too short
        script: 'This is a test script',
        voice_config: {
          provider: 'openai' as const,
          voice_id: 'alloy',
        },
        output_config: {
          format: 'mp3' as const,
          quality: 'standard' as const,
          is_public: false,
        },
      };

      expect(() => CreateTrackSchema.parse(invalidTrack)).toThrow();
    });

    it('should reject script that is too short', () => {
      const invalidTrack = {
        title: 'Test Track',
        script: 'Short', // Less than 10 characters
        voice_config: {
          provider: 'openai' as const,
          voice_id: 'alloy',
        },
        output_config: {
          format: 'mp3' as const,
          quality: 'standard' as const,
          is_public: false,
        },
      };

      expect(() => CreateTrackSchema.parse(invalidTrack)).toThrow();
    });

    it('should reject script that is too long', () => {
      const longScript = 'x'.repeat(5001); // More than 5000 characters
      const invalidTrack = {
        title: 'Test Track',
        script: longScript,
        voice_config: {
          provider: 'openai' as const,
          voice_id: 'alloy',
        },
        output_config: {
          format: 'mp3' as const,
          quality: 'standard' as const,
          is_public: false,
        },
      };

      expect(() => CreateTrackSchema.parse(invalidTrack)).toThrow();
    });

    it('should accept optional fields', () => {
      const trackWithOptionals = {
        title: 'Test Track',
        description: 'A test description',
        script: 'This is a test script for our track',
        voice_config: {
          provider: 'elevenlabs' as const,
          voice_id: 'custom-voice-id',
          settings: { speed: 1.2 },
        },
        music_config: {
          url: 'https://example.com/music.mp3',
          volume_db: -5,
        },
        frequency_config: {
          solfeggio: {
            frequency: 528,
            volume_db: -10,
          },
        },
        output_config: {
          format: 'wav' as const,
          quality: 'high' as const,
          is_public: true,
        },
        tags: ['meditation', 'relaxation'],
      };

      const result = CreateTrackSchema.parse(trackWithOptionals);
      expect(result.description).toBe('A test description');
      expect(result.music_config?.url).toBe('https://example.com/music.mp3');
      expect(result.tags).toEqual(['meditation', 'relaxation']);
    });
  });

  describe('UpdateTrackSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        title: 'Updated Title',
        tags: ['new', 'tags'],
      };

      const result = UpdateTrackSchema.parse(partialUpdate);
      expect(result.title).toBe('Updated Title');
      expect(result.tags).toEqual(['new', 'tags']);
    });

    it('should allow empty updates', () => {
      const emptyUpdate = {};
      const result = UpdateTrackSchema.parse(emptyUpdate);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('ListTracksSchema', () => {
    it('should apply default values', () => {
      const emptyQuery = {};
      const result = ListTracksSchema.parse(emptyQuery);
      
      expect(result.limit).toBe(20);
      expect(result.sort).toBe('created_at');
      expect(result.order).toBe('desc');
    });

    it('should validate cursor and limit', () => {
      const query = {
        cursor: 'some-cursor',
        limit: 50,
        status: 'published' as const,
      };

      const result = ListTracksSchema.parse(query);
      expect(result.cursor).toBe('some-cursor');
      expect(result.limit).toBe(50);
      expect(result.status).toBe('published');
    });

    it('should reject invalid limit', () => {
      const invalidQuery = {
        limit: 101, // More than max 100
      };

      expect(() => ListTracksSchema.parse(invalidQuery)).toThrow();
    });

    it('should accept tags array', () => {
      const query = {
        tags: ['meditation', 'sleep'],
      };

      const result = ListTracksSchema.parse(query);
      expect(result.tags).toEqual(['meditation', 'sleep']);
    });
  });

  describe('validateTrackConfig', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        title: 'Test Track',
        script: 'This is a valid test script',
        voice_config: {
          provider: 'openai' as const,
          voice_id: 'alloy',
        },
        output_config: {
          format: 'mp3' as const,
          quality: 'standard' as const,
          is_public: false,
        },
      };

      expect(() => validateTrackConfig(validConfig)).not.toThrow();
    });

    it('should reject missing voice configuration', () => {
      const invalidConfig = {
        title: 'Test Track',
        script: 'This is a test script',
        voice_config: {
          provider: 'openai' as const,
          voice_id: '', // Empty voice_id
        },
        output_config: {
          format: 'mp3' as const,
          quality: 'standard' as const,
          is_public: false,
        },
      };

      expect(() => validateTrackConfig(invalidConfig)).toThrow();
    });

    it('should reject script that is too long', () => {
      const longScript = 'x'.repeat(5001);
      const invalidConfig = {
        title: 'Test Track',
        script: longScript,
        voice_config: {
          provider: 'openai' as const,
          voice_id: 'alloy',
        },
        output_config: {
          format: 'mp3' as const,
          quality: 'standard' as const,
          is_public: false,
        },
      };

      expect(() => validateTrackConfig(invalidConfig)).toThrow();
    });
  });
});
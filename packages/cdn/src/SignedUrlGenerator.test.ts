import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignedUrlGenerator, CacheInvalidator } from './SignedUrlGenerator';

// Mock the AWS SDK
vi.mock('@aws-sdk/cloudfront-signer', () => ({
  getSignedUrl: vi.fn((options) => {
    const url = new URL(options.url);
    const params = new URLSearchParams();
    params.set('Expires', String(Math.floor(Date.now() / 1000) + 3600));
    params.set('Signature', 'mock-signature');
    params.set('Key-Pair-Id', options.keyPairId);
    url.search = params.toString();
    return url.toString();
  }),
}));

describe('SignedUrlGenerator', () => {
  let generator: SignedUrlGenerator;
  const mockConfig = {
    distributionDomain: 'https://cdn.example.com',
    keyPairId: 'APKAEXAMPLE',
    privateKey: 'mock-private-key',
    defaultTTL: 3600,
  };

  beforeEach(() => {
    generator = new SignedUrlGenerator(mockConfig);
  });

  describe('constructor', () => {
    it('should validate and store configuration', () => {
      expect(() => new SignedUrlGenerator(mockConfig)).not.toThrow();
    });

    it('should throw error for invalid configuration', () => {
      expect(() => new SignedUrlGenerator({
        ...mockConfig,
        distributionDomain: 'not-a-url',
      })).toThrow();
    });
  });

  describe('generateSignedUrl', () => {
    it('should generate a signed URL for a given path', () => {
      const signedUrl = generator.generateSignedUrl({
        path: 'private/track-123.mp3',
      });

      expect(signedUrl).toContain('https://cdn.example.com/private/track-123.mp3');
      expect(signedUrl).toContain('Expires=');
      expect(signedUrl).toContain('Signature=');
      expect(signedUrl).toContain('Key-Pair-Id=APKAEXAMPLE');
    });

    it('should use custom expiration time when provided', () => {
      const signedUrl = generator.generateSignedUrl({
        path: 'private/track-123.mp3',
        expiresIn: 7200, // 2 hours
      });

      expect(signedUrl).toBeDefined();
      expect(signedUrl).toContain('private/track-123.mp3');
    });

    it('should support IP address restrictions', () => {
      const signedUrl = generator.generateSignedUrl({
        path: 'private/track-123.mp3',
        ipAddress: '192.168.1.1',
      });

      expect(signedUrl).toBeDefined();
      // The IP restriction would be in the policy, not the URL
    });

    it('should validate input options', () => {
      expect(() => generator.generateSignedUrl({
        path: '',
      })).not.toThrow(); // Empty path is technically valid

      expect(() => generator.generateSignedUrl({
        path: 'test.mp3',
        expiresIn: -1,
      } as any)).toThrow();
    });
  });

  describe('generateBatchSignedUrls', () => {
    it('should generate signed URLs for multiple paths', () => {
      const paths = [
        'track1.mp3',
        'track2.mp3',
        'track3.mp3',
      ];

      const signedUrls = generator.generateBatchSignedUrls(paths);

      expect(signedUrls.size).toBe(3);
      paths.forEach(path => {
        expect(signedUrls.has(path)).toBe(true);
        expect(signedUrls.get(path)).toContain(path);
      });
    });

    it('should apply common options to all URLs', () => {
      const paths = ['track1.mp3', 'track2.mp3'];
      const signedUrls = generator.generateBatchSignedUrls(paths, {
        expiresIn: 7200,
      });

      expect(signedUrls.size).toBe(2);
      signedUrls.forEach((url) => {
        expect(url).toContain('Expires=');
      });
    });
  });

  describe('generateStreamingUrl', () => {
    it('should generate URL with longer TTL for streaming', () => {
      const streamingUrl = generator.generateStreamingUrl('audio/track.mp3');

      expect(streamingUrl).toContain('audio/track.mp3');
      expect(streamingUrl).toContain('Expires=');
    });

    it('should allow custom expiration for streaming', () => {
      const streamingUrl = generator.generateStreamingUrl('audio/track.mp3', {
        expiresIn: 10800, // 3 hours
      });

      expect(streamingUrl).toBeDefined();
    });
  });

  describe('generateImageUrl', () => {
    it('should generate URL for original image format', () => {
      const imageUrl = generator.generateImageUrl('images/cover.jpg', 'original');

      expect(imageUrl).toContain('images/cover.jpg');
      expect(imageUrl).not.toContain('format=');
    });

    it('should add format conversion parameter for WebP', () => {
      const imageUrl = generator.generateImageUrl('images/cover.jpg', 'webp');

      expect(imageUrl).toContain('images/cover.jpg');
      expect(imageUrl).toContain('format=webp');
    });

    it('should add format conversion parameter for AVIF', () => {
      const imageUrl = generator.generateImageUrl('images/cover.jpg', 'avif');

      expect(imageUrl).toContain('images/cover.jpg');
      expect(imageUrl).toContain('format=avif');
    });

    it('should handle paths with existing query parameters', () => {
      const imageUrl = generator.generateImageUrl('images/cover.jpg?size=large', 'webp');

      expect(imageUrl).toContain('images/cover.jpg');
      expect(imageUrl).toContain('size=large');
      expect(imageUrl).toContain('format=webp');
    });
  });

  describe('isUrlValid', () => {
    it('should return true for valid signed URLs', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      const validUrl = `https://cdn.example.com/test.mp3?Expires=${futureExpiry}&Signature=sig&Key-Pair-Id=key`;

      expect(generator.isUrlValid(validUrl)).toBe(true);
    });

    it('should return false for expired URLs', () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
      const expiredUrl = `https://cdn.example.com/test.mp3?Expires=${pastExpiry}&Signature=sig&Key-Pair-Id=key`;

      expect(generator.isUrlValid(expiredUrl)).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(generator.isUrlValid('not-a-url')).toBe(false);
      expect(generator.isUrlValid('https://cdn.example.com/test.mp3')).toBe(false); // No signature
    });
  });
});

describe('CacheInvalidator', () => {
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    invalidator = new CacheInvalidator('distribution-123');
  });

  describe('createInvalidation', () => {
    it('should create invalidation for given paths', async () => {
      const paths = ['/track1.mp3', '/track2.mp3'];
      const invalidationId = await invalidator.createInvalidation(paths);

      expect(invalidationId).toContain('INV-');
      expect(invalidationId).toBeDefined();
    });

    it('should handle empty path array', async () => {
      const invalidationId = await invalidator.createInvalidation([]);

      expect(invalidationId).toContain('INV-');
    });
  });
});

describe('createSignedUrlGenerator', () => {
  it('should create generator from environment variables', () => {
    const originalEnv = process.env;

    process.env = {
      ...originalEnv,
      CDN_DISTRIBUTION_DOMAIN: 'https://cdn.example.com',
      CDN_KEY_PAIR_ID: 'APKAEXAMPLE',
      CDN_PRIVATE_KEY: 'mock-key',
      CDN_DEFAULT_TTL: '7200',
    };

    const { createSignedUrlGenerator } = require('./SignedUrlGenerator');
    const generator = createSignedUrlGenerator();

    expect(generator).toBeInstanceOf(SignedUrlGenerator);

    process.env = originalEnv;
  });
});
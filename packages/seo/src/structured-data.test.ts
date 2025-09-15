import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  OrganizationSchema,
  PersonSchema,
  AudioObjectSchema,
  MusicPlaylistSchema,
  ProductSchema,
  BreadcrumbListSchema,
  WebPageSchema,
  WebSiteSchema,
  generateAudioObjectJsonLd,
  generatePersonJsonLd,
  generateMusicPlaylistJsonLd,
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  generateOrganizationJsonLd,
} from './structured-data';

describe('Structured Data Schemas', () => {
  describe('OrganizationSchema', () => {
    it('should validate valid organization data', () => {
      const validOrg = {
        '@type': 'Organization' as const,
        '@context': 'https://schema.org',
        name: 'MindScript',
        url: 'https://mindscript.app',
        logo: 'https://mindscript.app/logo.png',
        description: 'AI-powered meditation platform',
        sameAs: ['https://twitter.com/mindscript'],
      };

      const result = OrganizationSchema.parse(validOrg);
      expect(result).toEqual(validOrg);
    });

    it('should require minimum fields', () => {
      const minOrg = {
        '@type': 'Organization' as const,
        '@context': 'https://schema.org',
        name: 'MindScript',
        url: 'https://mindscript.app',
      };

      const result = OrganizationSchema.parse(minOrg);
      expect(result).toEqual(minOrg);
    });
  });

  describe('AudioObjectSchema', () => {
    it('should validate valid audio object data', () => {
      const validAudio = {
        '@type': 'AudioObject' as const,
        '@context': 'https://schema.org',
        name: 'Morning Meditation',
        description: 'A calming morning meditation',
        url: 'https://mindscript.app/tracks/123',
        contentUrl: 'https://cdn.mindscript.app/audio/123.mp3',
        duration: 'PT10M30S',
        encodingFormat: 'audio/mpeg',
        author: {
          '@type': 'Person' as const,
          name: 'John Doe',
          url: 'https://mindscript.app/u/johndoe',
        },
        datePublished: '2024-01-01T00:00:00Z',
        inLanguage: 'en',
        thumbnailUrl: 'https://cdn.mindscript.app/thumbnails/123.jpg',
      };

      const result = AudioObjectSchema.parse(validAudio);
      expect(result).toEqual(validAudio);
    });
  });

  describe('MusicPlaylistSchema', () => {
    it('should validate valid playlist data', () => {
      const validPlaylist = {
        '@type': 'MusicPlaylist' as const,
        '@context': 'https://schema.org',
        name: 'Sleep Meditations',
        description: 'Collection of sleep meditations',
        url: 'https://mindscript.app/playlists/456',
        numTracks: 10,
        author: {
          '@type': 'Person' as const,
          name: 'Jane Smith',
          url: 'https://mindscript.app/u/janesmith',
        },
        datePublished: '2024-01-01T00:00:00Z',
        track: [
          {
            '@type': 'AudioObject' as const,
            name: 'Track 1',
            url: 'https://mindscript.app/tracks/1',
            contentUrl: 'https://cdn.mindscript.app/audio/1.mp3',
            duration: 'PT5M',
          },
        ],
      };

      const result = MusicPlaylistSchema.parse(validPlaylist);
      expect(result).toEqual(validPlaylist);
    });
  });

  describe('BreadcrumbListSchema', () => {
    it('should validate valid breadcrumb data', () => {
      const validBreadcrumb = {
        '@type': 'BreadcrumbList' as const,
        '@context': 'https://schema.org',
        itemListElement: [
          {
            '@type': 'ListItem' as const,
            position: 1,
            name: 'Home',
            item: 'https://mindscript.app',
          },
          {
            '@type': 'ListItem' as const,
            position: 2,
            name: 'Marketplace',
            item: 'https://mindscript.app/marketplace',
          },
          {
            '@type': 'ListItem' as const,
            position: 3,
            name: 'Meditation Track',
          },
        ],
      };

      const result = BreadcrumbListSchema.parse(validBreadcrumb);
      expect(result).toEqual(validBreadcrumb);
    });
  });
});

describe('JSON-LD Generation Functions', () => {
  describe('generateAudioObjectJsonLd', () => {
    it('should generate valid AudioObject JSON-LD', () => {
      const jsonLd = generateAudioObjectJsonLd({
        name: 'Test Track',
        description: 'Test description',
        url: 'https://mindscript.app/tracks/test',
        contentUrl: 'https://cdn.mindscript.app/audio/test.mp3',
        duration: 'PT5M',
        author: {
          name: 'Test Author',
          url: 'https://mindscript.app/u/testauthor',
        },
        datePublished: '2024-01-01T00:00:00Z',
      });

      expect(jsonLd['@type']).toBe('AudioObject');
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd.name).toBe('Test Track');
      expect(jsonLd.encodingFormat).toBe('audio/mpeg');
    });

    it('should include offers when price is provided', () => {
      const jsonLd = generateAudioObjectJsonLd({
        name: 'Premium Track',
        description: 'Premium meditation',
        url: 'https://mindscript.app/tracks/premium',
        contentUrl: 'https://cdn.mindscript.app/audio/premium.mp3',
        duration: 'PT10M',
        author: {
          name: 'Premium Author',
          url: 'https://mindscript.app/u/premiumauthor',
        },
        datePublished: '2024-01-01T00:00:00Z',
        price: 9.99,
        priceCurrency: 'USD',
      });

      expect(jsonLd.offers).toBeDefined();
      expect(jsonLd.offers?.['@type']).toBe('Offer');
      expect(jsonLd.offers?.price).toBe('9.99');
      expect(jsonLd.offers?.priceCurrency).toBe('USD');
    });
  });

  describe('generateBreadcrumbJsonLd', () => {
    it('should generate valid breadcrumb JSON-LD', () => {
      const breadcrumbs = [
        { name: 'Home', url: 'https://mindscript.app' },
        { name: 'Marketplace', url: 'https://mindscript.app/marketplace' },
        { name: 'Track' },
      ];

      const jsonLd = generateBreadcrumbJsonLd(breadcrumbs);

      expect(jsonLd['@type']).toBe('BreadcrumbList');
      expect(jsonLd.itemListElement).toHaveLength(3);
      expect(jsonLd.itemListElement[0].position).toBe(1);
      expect(jsonLd.itemListElement[2].item).toBeUndefined();
    });
  });

  describe('generateOrganizationJsonLd', () => {
    it('should generate valid organization JSON-LD', () => {
      const jsonLd = generateOrganizationJsonLd({
        name: 'MindScript',
        url: 'https://mindscript.app',
        logo: 'https://mindscript.app/logo.png',
        description: 'AI-powered meditation platform',
        sameAs: ['https://twitter.com/mindscript'],
      });

      expect(jsonLd['@type']).toBe('Organization');
      expect(jsonLd.name).toBe('MindScript');
      expect(jsonLd.sameAs).toContain('https://twitter.com/mindscript');
    });
  });
});
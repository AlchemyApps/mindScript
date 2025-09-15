import { describe, it, expect } from 'vitest';
import {
  generateMetaTags,
  generateOpenGraphTags,
  generateTwitterTags,
  generateCanonicalUrl,
  generateHreflangTags,
  type MetaTagsConfig,
} from './meta-tags';

describe('Meta Tags Generation', () => {
  describe('generateMetaTags', () => {
    it('should generate basic meta tags', () => {
      const config: MetaTagsConfig = {
        title: 'Test Page',
        description: 'Test description',
        keywords: ['meditation', 'mindfulness'],
        author: 'John Doe',
        robots: 'index,follow',
      };

      const tags = generateMetaTags(config);

      expect(tags.title).toBe('Test Page');
      expect(tags.description).toBe('Test description');
      expect(tags.keywords).toBe('meditation, mindfulness');
      expect(tags.author).toBe('John Doe');
      expect(tags.robots).toBe('index,follow');
    });

    it('should handle optional fields', () => {
      const config: MetaTagsConfig = {
        title: 'Minimal Page',
      };

      const tags = generateMetaTags(config);

      expect(tags.title).toBe('Minimal Page');
      expect(tags.description).toBeUndefined();
      expect(tags.keywords).toBeUndefined();
    });

    it('should include viewport and charset', () => {
      const config: MetaTagsConfig = {
        title: 'Test Page',
        viewport: 'width=device-width, initial-scale=1',
        charset: 'utf-8',
      };

      const tags = generateMetaTags(config);

      expect(tags.viewport).toBe('width=device-width, initial-scale=1');
      expect(tags.charset).toBe('utf-8');
    });
  });

  describe('generateOpenGraphTags', () => {
    it('should generate complete OpenGraph tags', () => {
      const tags = generateOpenGraphTags({
        title: 'OG Title',
        description: 'OG Description',
        url: 'https://mindscript.app/page',
        image: 'https://mindscript.app/image.jpg',
        type: 'website',
        siteName: 'MindScript',
        locale: 'en_US',
        audio: 'https://mindscript.app/audio.mp3',
      });

      expect(tags).toEqual({
        'og:title': 'OG Title',
        'og:description': 'OG Description',
        'og:url': 'https://mindscript.app/page',
        'og:image': 'https://mindscript.app/image.jpg',
        'og:type': 'website',
        'og:site_name': 'MindScript',
        'og:locale': 'en_US',
        'og:audio': 'https://mindscript.app/audio.mp3',
      });
    });

    it('should handle music.song type with additional properties', () => {
      const tags = generateOpenGraphTags({
        title: 'Meditation Track',
        url: 'https://mindscript.app/track/123',
        type: 'music.song',
        audio: 'https://mindscript.app/audio/123.mp3',
        musicDuration: 300,
        musicAlbum: 'Morning Meditations',
        musicMusician: 'John Doe',
      });

      expect(tags['og:type']).toBe('music.song');
      expect(tags['music:duration']).toBe(300);
      expect(tags['music:album']).toBe('Morning Meditations');
      expect(tags['music:musician']).toBe('John Doe');
    });

    it('should handle image with dimensions', () => {
      const tags = generateOpenGraphTags({
        title: 'Test',
        url: 'https://mindscript.app',
        image: 'https://mindscript.app/image.jpg',
        imageWidth: 1200,
        imageHeight: 630,
        imageAlt: 'Test image',
      });

      expect(tags['og:image:width']).toBe(1200);
      expect(tags['og:image:height']).toBe(630);
      expect(tags['og:image:alt']).toBe('Test image');
    });
  });

  describe('generateTwitterTags', () => {
    it('should generate Twitter card tags', () => {
      const tags = generateTwitterTags({
        card: 'summary_large_image',
        title: 'Twitter Title',
        description: 'Twitter Description',
        image: 'https://mindscript.app/twitter.jpg',
        site: '@mindscript',
        creator: '@johndoe',
      });

      expect(tags).toEqual({
        'twitter:card': 'summary_large_image',
        'twitter:title': 'Twitter Title',
        'twitter:description': 'Twitter Description',
        'twitter:image': 'https://mindscript.app/twitter.jpg',
        'twitter:site': '@mindscript',
        'twitter:creator': '@johndoe',
      });
    });

    it('should handle player card type', () => {
      const tags = generateTwitterTags({
        card: 'player',
        title: 'Audio Track',
        player: 'https://mindscript.app/player/123',
        playerWidth: 480,
        playerHeight: 480,
        playerStream: 'https://mindscript.app/stream/123.mp3',
      });

      expect(tags['twitter:card']).toBe('player');
      expect(tags['twitter:player']).toBe('https://mindscript.app/player/123');
      expect(tags['twitter:player:width']).toBe(480);
      expect(tags['twitter:player:height']).toBe(480);
      expect(tags['twitter:player:stream']).toBe('https://mindscript.app/stream/123.mp3');
    });
  });

  describe('generateCanonicalUrl', () => {
    it('should generate canonical URL with default base', () => {
      const url = generateCanonicalUrl('/page/test');
      expect(url).toBe('https://mindscript.app/page/test');
    });

    it('should use custom base URL', () => {
      const url = generateCanonicalUrl('/page/test', 'https://custom.com');
      expect(url).toBe('https://custom.com/page/test');
    });

    it('should handle absolute URLs', () => {
      const url = generateCanonicalUrl('https://example.com/page');
      expect(url).toBe('https://example.com/page');
    });

    it('should normalize URLs', () => {
      const url = generateCanonicalUrl('//page//test//', 'https://mindscript.app/');
      expect(url).toBe('https://mindscript.app/page/test');
    });

    it('should preserve query parameters', () => {
      const url = generateCanonicalUrl('/page?id=123&sort=asc');
      expect(url).toBe('https://mindscript.app/page?id=123&sort=asc');
    });
  });

  describe('generateHreflangTags', () => {
    it('should generate hreflang tags for multiple languages', () => {
      const tags = generateHreflangTags({
        url: '/page/test',
        languages: [
          { lang: 'en', url: '/page/test' },
          { lang: 'es', url: '/es/page/test' },
          { lang: 'fr', url: '/fr/page/test' },
        ],
        defaultLang: 'en',
      });

      expect(tags).toEqual([
        { hreflang: 'en', href: 'https://mindscript.app/page/test' },
        { hreflang: 'es', href: 'https://mindscript.app/es/page/test' },
        { hreflang: 'fr', href: 'https://mindscript.app/fr/page/test' },
        { hreflang: 'x-default', href: 'https://mindscript.app/page/test' },
      ]);
    });

    it('should handle region-specific languages', () => {
      const tags = generateHreflangTags({
        url: '/page',
        languages: [
          { lang: 'en-US', url: '/page' },
          { lang: 'en-GB', url: '/uk/page' },
          { lang: 'es-ES', url: '/es/page' },
          { lang: 'es-MX', url: '/mx/page' },
        ],
        defaultLang: 'en-US',
      });

      expect(tags).toHaveLength(5); // 4 languages + x-default
      expect(tags.find(t => t.hreflang === 'en-US')).toBeDefined();
      expect(tags.find(t => t.hreflang === 'en-GB')).toBeDefined();
      expect(tags.find(t => t.hreflang === 'x-default')?.href).toBe('https://mindscript.app/page');
    });

    it('should use custom base URL', () => {
      const tags = generateHreflangTags({
        url: '/page',
        languages: [{ lang: 'en', url: '/page' }],
        defaultLang: 'en',
        baseUrl: 'https://custom.com',
      });

      expect(tags[0].href).toBe('https://custom.com/page');
    });
  });
});
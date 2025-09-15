import { describe, it, expect } from 'vitest';
import {
  generateSitemapUrl,
  generateSitemap,
  generateSitemapIndex,
  type SitemapUrl,
  type SitemapConfig,
} from './sitemap';

describe('Sitemap Generation', () => {
  describe('generateSitemapUrl', () => {
    it('should generate a basic sitemap URL entry', () => {
      const url = generateSitemapUrl({
        loc: 'https://mindscript.app/page',
      });

      expect(url).toEqual({
        loc: 'https://mindscript.app/page',
      });
    });

    it('should include all optional fields', () => {
      const url = generateSitemapUrl({
        loc: 'https://mindscript.app/page',
        lastmod: '2024-01-01',
        changefreq: 'weekly',
        priority: 0.8,
      });

      expect(url).toEqual({
        loc: 'https://mindscript.app/page',
        lastmod: '2024-01-01',
        changefreq: 'weekly',
        priority: 0.8,
      });
    });

    it('should handle image data', () => {
      const url = generateSitemapUrl({
        loc: 'https://mindscript.app/track/123',
        images: [
          {
            loc: 'https://cdn.mindscript.app/images/track-123.jpg',
            title: 'Track Cover',
            caption: 'Cover art for meditation track',
          },
        ],
      });

      expect(url.images).toHaveLength(1);
      expect(url.images?.[0].loc).toBe('https://cdn.mindscript.app/images/track-123.jpg');
    });

    it('should handle video data', () => {
      const url = generateSitemapUrl({
        loc: 'https://mindscript.app/video/456',
        videos: [
          {
            thumbnail_loc: 'https://cdn.mindscript.app/thumbnails/video-456.jpg',
            title: 'Meditation Guide',
            description: 'Video meditation guide',
            content_loc: 'https://cdn.mindscript.app/videos/456.mp4',
            duration: 600,
          },
        ],
      });

      expect(url.videos).toHaveLength(1);
      expect(url.videos?.[0].duration).toBe(600);
    });
  });

  describe('generateSitemap', () => {
    it('should generate valid XML sitemap', () => {
      const urls: SitemapUrl[] = [
        {
          loc: 'https://mindscript.app/',
          lastmod: '2024-01-01',
          changefreq: 'daily',
          priority: 1.0,
        },
        {
          loc: 'https://mindscript.app/marketplace',
          lastmod: '2024-01-01',
          changefreq: 'weekly',
          priority: 0.8,
        },
      ];

      const xml = generateSitemap({ urls });

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(xml).toContain('<loc>https://mindscript.app/</loc>');
      expect(xml).toContain('<loc>https://mindscript.app/marketplace</loc>');
      expect(xml).toContain('<changefreq>daily</changefreq>');
      expect(xml).toContain('<priority>1.0</priority>');
    });

    it('should include image namespace when images are present', () => {
      const urls: SitemapUrl[] = [
        {
          loc: 'https://mindscript.app/track/123',
          images: [
            {
              loc: 'https://cdn.mindscript.app/images/track.jpg',
              title: 'Track Image',
            },
          ],
        },
      ];

      const xml = generateSitemap({ urls });

      expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
      expect(xml).toContain('<image:image>');
      expect(xml).toContain('<image:loc>https://cdn.mindscript.app/images/track.jpg</image:loc>');
      expect(xml).toContain('<image:title>Track Image</image:title>');
    });

    it('should include video namespace when videos are present', () => {
      const urls: SitemapUrl[] = [
        {
          loc: 'https://mindscript.app/video/123',
          videos: [
            {
              thumbnail_loc: 'https://cdn.mindscript.app/thumb.jpg',
              title: 'Video Title',
              description: 'Video Description',
            },
          ],
        },
      ];

      const xml = generateSitemap({ urls });

      expect(xml).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
      expect(xml).toContain('<video:video>');
      expect(xml).toContain('<video:thumbnail_loc>https://cdn.mindscript.app/thumb.jpg</video:thumbnail_loc>');
      expect(xml).toContain('<video:title>Video Title</video:title>');
    });

    it('should escape special XML characters', () => {
      const urls: SitemapUrl[] = [
        {
          loc: 'https://mindscript.app/page?id=1&type=test',
          images: [
            {
              loc: 'https://cdn.mindscript.app/image.jpg',
              title: 'Title with <special> & "characters"',
              caption: "Caption with 'quotes' and <tags>",
            },
          ],
        },
      ];

      const xml = generateSitemap({ urls });

      expect(xml).toContain('id=1&amp;type=test');
      expect(xml).toContain('Title with &lt;special&gt; &amp; &quot;characters&quot;');
      expect(xml).toContain('Caption with &apos;quotes&apos; and &lt;tags&gt;');
    });

    it('should limit URLs to maxUrls parameter', () => {
      const urls: SitemapUrl[] = Array.from({ length: 100 }, (_, i) => ({
        loc: `https://mindscript.app/page-${i}`,
      }));

      const xml = generateSitemap({ urls, maxUrls: 10 });

      // Count the number of <url> tags
      const urlMatches = xml.match(/<url>/g);
      expect(urlMatches?.length).toBe(10);
    });
  });

  describe('generateSitemapIndex', () => {
    it('should generate valid sitemap index XML', () => {
      const sitemaps = [
        {
          loc: 'https://mindscript.app/sitemap-1.xml',
          lastmod: '2024-01-01',
        },
        {
          loc: 'https://mindscript.app/sitemap-2.xml',
          lastmod: '2024-01-02',
        },
      ];

      const xml = generateSitemapIndex(sitemaps);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain('<sitemap>');
      expect(xml).toContain('<loc>https://mindscript.app/sitemap-1.xml</loc>');
      expect(xml).toContain('<lastmod>2024-01-01</lastmod>');
      expect(xml).toContain('</sitemapindex>');
    });

    it('should handle sitemaps without lastmod', () => {
      const sitemaps = [
        {
          loc: 'https://mindscript.app/sitemap.xml',
        },
      ];

      const xml = generateSitemapIndex(sitemaps);

      expect(xml).toContain('<loc>https://mindscript.app/sitemap.xml</loc>');
      expect(xml).not.toContain('<lastmod>');
    });
  });

  describe('Sitemap Config', () => {
    it('should generate sitemap with custom base URL', () => {
      const config: SitemapConfig = {
        urls: [
          { loc: '/page-1' },
          { loc: '/page-2' },
        ],
        baseUrl: 'https://custom.com',
      };

      const xml = generateSitemap(config);

      expect(xml).toContain('<loc>https://custom.com/page-1</loc>');
      expect(xml).toContain('<loc>https://custom.com/page-2</loc>');
    });

    it('should handle absolute URLs mixed with relative URLs', () => {
      const config: SitemapConfig = {
        urls: [
          { loc: '/relative-page' },
          { loc: 'https://absolute.com/page' },
        ],
        baseUrl: 'https://mindscript.app',
      };

      const xml = generateSitemap(config);

      expect(xml).toContain('<loc>https://mindscript.app/relative-page</loc>');
      expect(xml).toContain('<loc>https://absolute.com/page</loc>');
    });
  });
});
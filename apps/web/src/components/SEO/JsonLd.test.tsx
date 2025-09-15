import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd, AudioObjectJsonLd, PersonJsonLd, MusicPlaylistJsonLd, BreadcrumbJsonLd, OrganizationJsonLd } from './JsonLd';

describe('JsonLd Components', () => {
  describe('JsonLd', () => {
    it('should render JSON-LD script tag with proper data', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Thing',
        name: 'Test Thing',
      };

      const { container } = render(<JsonLd data={data} />);
      const script = container.querySelector('script[type="application/ld+json"]');

      expect(script).toBeTruthy();
      expect(script?.innerHTML).toBe(JSON.stringify(data));
    });

    it('should handle complex nested data', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'John Doe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '123 Main St',
          addressLocality: 'City',
        },
      };

      const { container } = render(<JsonLd data={data} />);
      const script = container.querySelector('script[type="application/ld+json"]');

      expect(script?.innerHTML).toBe(JSON.stringify(data));
    });
  });

  describe('AudioObjectJsonLd', () => {
    it('should render AudioObject schema', () => {
      const props = {
        name: 'Test Audio',
        description: 'Test Description',
        url: 'https://mindscript.app/track/123',
        contentUrl: 'https://cdn.mindscript.app/audio/123.mp3',
        duration: 'PT10M30S',
        author: {
          name: 'John Doe',
          url: 'https://mindscript.app/u/johndoe',
        },
        datePublished: '2024-01-01T00:00:00Z',
      };

      const { container } = render(<AudioObjectJsonLd {...props} />);
      const script = container.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(script?.innerHTML || '{}');

      expect(data['@type']).toBe('AudioObject');
      expect(data.name).toBe('Test Audio');
      expect(data.contentUrl).toBe('https://cdn.mindscript.app/audio/123.mp3');
      expect(data.author['@type']).toBe('Person');
    });

    it('should include offers when price is provided', () => {
      const props = {
        name: 'Premium Audio',
        url: 'https://mindscript.app/track/premium',
        contentUrl: 'https://cdn.mindscript.app/audio/premium.mp3',
        duration: 'PT15M',
        price: 9.99,
        priceCurrency: 'USD',
      };

      const { container } = render(<AudioObjectJsonLd {...props} />);
      const script = container.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(script?.innerHTML || '{}');

      expect(data.offers).toBeDefined();
      expect(data.offers['@type']).toBe('Offer');
      expect(data.offers.price).toBe('9.99');
      expect(data.offers.priceCurrency).toBe('USD');
    });
  });

  describe('PersonJsonLd', () => {
    it('should render Person schema', () => {
      const props = {
        name: 'Jane Smith',
        url: 'https://mindscript.app/u/janesmith',
        image: 'https://mindscript.app/images/janesmith.jpg',
        description: 'Meditation instructor',
        sameAs: ['https://twitter.com/janesmith'],
      };

      const { container } = render(<PersonJsonLd {...props} />);
      const script = container.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(script?.innerHTML || '{}');

      expect(data['@type']).toBe('Person');
      expect(data.name).toBe('Jane Smith');
      expect(data.url).toBe('https://mindscript.app/u/janesmith');
      expect(data.sameAs).toContain('https://twitter.com/janesmith');
    });
  });

  describe('MusicPlaylistJsonLd', () => {
    it('should render MusicPlaylist schema', () => {
      const props = {
        name: 'Sleep Meditations',
        description: 'Collection of sleep meditations',
        url: 'https://mindscript.app/playlists/sleep',
        numTracks: 10,
        author: {
          name: 'Playlist Creator',
          url: 'https://mindscript.app/u/creator',
        },
        tracks: [
          {
            name: 'Track 1',
            url: 'https://mindscript.app/track/1',
            contentUrl: 'https://cdn.mindscript.app/audio/1.mp3',
            duration: 'PT5M',
          },
          {
            name: 'Track 2',
            url: 'https://mindscript.app/track/2',
            contentUrl: 'https://cdn.mindscript.app/audio/2.mp3',
            duration: 'PT8M',
          },
        ],
      };

      const { container } = render(<MusicPlaylistJsonLd {...props} />);
      const script = container.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(script?.innerHTML || '{}');

      expect(data['@type']).toBe('MusicPlaylist');
      expect(data.name).toBe('Sleep Meditations');
      expect(data.numTracks).toBe(10);
      expect(data.track).toHaveLength(2);
      expect(data.track[0]['@type']).toBe('AudioObject');
    });
  });

  describe('BreadcrumbJsonLd', () => {
    it('should render BreadcrumbList schema', () => {
      const items = [
        { name: 'Home', url: 'https://mindscript.app' },
        { name: 'Marketplace', url: 'https://mindscript.app/marketplace' },
        { name: 'Meditation Track' },
      ];

      const { container } = render(<BreadcrumbJsonLd items={items} />);
      const script = container.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(script?.innerHTML || '{}');

      expect(data['@type']).toBe('BreadcrumbList');
      expect(data.itemListElement).toHaveLength(3);
      expect(data.itemListElement[0].position).toBe(1);
      expect(data.itemListElement[0].name).toBe('Home');
      expect(data.itemListElement[2].item).toBeUndefined(); // Last item has no URL
    });
  });

  describe('OrganizationJsonLd', () => {
    it('should render Organization schema', () => {
      const props = {
        name: 'MindScript',
        url: 'https://mindscript.app',
        logo: 'https://mindscript.app/logo.png',
        description: 'AI-powered meditation platform',
        sameAs: ['https://twitter.com/mindscript', 'https://facebook.com/mindscript'],
        contactPoint: {
          telephone: '+1-555-0123',
          contactType: 'customer service',
          email: 'support@mindscript.app',
        },
      };

      const { container } = render(<OrganizationJsonLd {...props} />);
      const script = container.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(script?.innerHTML || '{}');

      expect(data['@type']).toBe('Organization');
      expect(data.name).toBe('MindScript');
      expect(data.logo).toBe('https://mindscript.app/logo.png');
      expect(data.sameAs).toHaveLength(2);
      expect(data.contactPoint['@type']).toBe('ContactPoint');
      expect(data.contactPoint.email).toBe('support@mindscript.app');
    });
  });
});
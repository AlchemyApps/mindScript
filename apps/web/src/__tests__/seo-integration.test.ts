import { describe, it, expect, vi } from 'vitest';
import { generateTrackMetadata, generateSellerMetadata, generatePlaylistMetadata, generateCategoryMetadata } from '@/components/SEO/MetaTags';
import { generateTrackPageSchema, generatePlaylistPageSchema, generateSiteOrganizationSchema } from '@/utils/seo/schemaGenerator';
import { generateBreadcrumbsFromPath } from '@/components/SEO/Breadcrumb';

describe('SEO Integration Tests', () => {
  describe('Track Page SEO', () => {
    const mockTrack = {
      id: 'track-123',
      title: 'Morning Meditation',
      description: 'A peaceful morning meditation to start your day',
      duration_seconds: 600,
      price_cents: 999,
      audio_url: 'https://cdn.mindscript.app/audio/track-123.mp3',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      play_count: 100,
      profiles: {
        id: 'user-123',
        username: 'johndoe',
        full_name: 'John Doe',
        avatar_url: 'https://cdn.mindscript.app/avatars/johndoe.jpg',
        bio: 'Meditation instructor',
      },
    };

    it('should generate complete track metadata', () => {
      const metadata = generateTrackMetadata({
        title: mockTrack.title,
        description: mockTrack.description,
        sellerName: mockTrack.profiles.full_name,
        sellerUsername: mockTrack.profiles.username,
        trackId: mockTrack.id,
        duration: mockTrack.duration_seconds,
        price: mockTrack.price_cents / 100,
        publishedAt: mockTrack.created_at,
        modifiedAt: mockTrack.updated_at,
      });

      expect(metadata.title).toBe('Morning Meditation by John Doe | MindScript');
      expect(metadata.description).toBe('A peaceful morning meditation to start your day');
      expect(metadata.openGraph?.type).toBe('music.song');
      expect(metadata.twitter?.card).toBe('summary_large_image');
    });

    it('should generate complete track schema', () => {
      const schema = generateTrackPageSchema(mockTrack);

      expect(schema.audioObject['@type']).toBe('AudioObject');
      expect(schema.audioObject.name).toBe('Morning Meditation');
      expect(schema.audioObject.duration).toBe('PT10M');
      expect(schema.audioObject.offers?.price).toBe('9.99');

      expect(schema.person['@type']).toBe('Person');
      expect(schema.person.name).toBe('John Doe');

      expect(schema.product?.['@type']).toBe('Product');
      expect(schema.product?.offers?.price).toBe('9.99');
    });

    it('should generate track breadcrumbs', () => {
      const breadcrumbs = generateBreadcrumbsFromPath('/u/johndoe/track-123');

      expect(breadcrumbs).toHaveLength(4);
      expect(breadcrumbs[0]).toEqual({ name: 'Home', url: '/' });
      expect(breadcrumbs[1]).toEqual({ name: 'Creators', url: '/marketplace' });
      expect(breadcrumbs[2]).toEqual({ name: '@johndoe', url: '/u/johndoe' });
      expect(breadcrumbs[3].name).toBe('Track 123');
    });
  });

  describe('Seller Profile SEO', () => {
    it('should generate seller metadata', () => {
      const metadata = generateSellerMetadata({
        name: 'Jane Smith',
        username: 'janesmith',
        bio: 'Creating mindful meditation experiences',
        imageUrl: 'https://cdn.mindscript.app/avatars/janesmith.jpg',
        trackCount: 25,
      });

      expect(metadata.title).toBe('Jane Smith | MindScript Creator');
      expect(metadata.description).toContain('Creating mindful meditation experiences');
      expect(metadata.openGraph?.type).toBe('profile');
      expect(metadata.twitter?.creator).toBe('@janesmith');
    });

    it('should generate seller breadcrumbs', () => {
      const breadcrumbs = generateBreadcrumbsFromPath('/u/janesmith');

      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[2]).toEqual({ name: '@janesmith', url: '/u/janesmith' });
    });
  });

  describe('Playlist Page SEO', () => {
    const mockPlaylist = {
      id: 'playlist-456',
      title: 'Sleep Collection',
      description: 'Curated tracks for better sleep',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      profiles: {
        username: 'curator',
        full_name: 'The Curator',
      },
      playlist_tracks: [
        {
          tracks: {
            id: 'track-1',
            title: 'Sleep Track 1',
            duration_seconds: 300,
            audio_url: 'https://cdn.mindscript.app/audio/track-1.mp3',
            profiles: {
              username: 'artist1',
            },
          },
        },
        {
          tracks: {
            id: 'track-2',
            title: 'Sleep Track 2',
            duration_seconds: 400,
            audio_url: 'https://cdn.mindscript.app/audio/track-2.mp3',
            profiles: {
              username: 'artist2',
            },
          },
        },
      ],
    };

    it('should generate playlist metadata', () => {
      const metadata = generatePlaylistMetadata({
        title: mockPlaylist.title,
        description: mockPlaylist.description,
        creatorName: mockPlaylist.profiles.full_name,
        playlistId: mockPlaylist.id,
        trackCount: mockPlaylist.playlist_tracks.length,
        publishedAt: mockPlaylist.created_at,
      });

      expect(metadata.title).toBe('Sleep Collection - Playlist by The Curator | MindScript');
      expect(metadata.description).toBe('Curated tracks for better sleep');
      expect(metadata.openGraph?.type).toBe('music.playlist');
    });

    it('should generate playlist schema', () => {
      const schema = generatePlaylistPageSchema(mockPlaylist);

      expect(schema.musicPlaylist['@type']).toBe('MusicPlaylist');
      expect(schema.musicPlaylist.name).toBe('Sleep Collection');
      expect(schema.musicPlaylist.numTracks).toBe(2);
      expect(schema.musicPlaylist.track).toHaveLength(2);
      expect(schema.musicPlaylist.track?.[0].duration).toBe('PT5M');

      expect(schema.person['@type']).toBe('Person');
      expect(schema.person.name).toBe('The Curator');
    });

    it('should generate playlist breadcrumbs', () => {
      const breadcrumbs = generateBreadcrumbsFromPath('/playlists/playlist-456');

      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0]).toEqual({ name: 'Home', url: '/' });
      expect(breadcrumbs[1]).toEqual({ name: 'Playlists', url: '/playlists' });
      expect(breadcrumbs[2].name).toBe('Playlist 456');
    });
  });

  describe('Marketplace Category SEO', () => {
    it('should generate category metadata', () => {
      const metadata = generateCategoryMetadata({
        category: 'meditation',
        trackCount: 150,
      });

      expect(metadata.title).toBe('Meditation Meditations | MindScript Marketplace');
      expect(metadata.description).toContain('150 meditation');
      expect(metadata.keywords).toContain('meditation');
    });

    it('should generate category breadcrumbs', () => {
      const breadcrumbs = generateBreadcrumbsFromPath('/marketplace/category/meditation');

      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0]).toEqual({ name: 'Home', url: '/' });
      expect(breadcrumbs[1]).toEqual({ name: 'Marketplace', url: '/marketplace' });
      expect(breadcrumbs[2]).toEqual({
        name: 'Meditation',
        url: '/marketplace/category/meditation'
      });
    });
  });

  describe('Site-wide SEO', () => {
    it('should generate organization schema', () => {
      const schema = generateSiteOrganizationSchema();

      expect(schema['@type']).toBe('Organization');
      expect(schema.name).toBe('MindScript');
      expect(schema.url).toBe('https://mindscript.app');
      expect(schema.sameAs).toContain('https://twitter.com/mindscript');
      expect(schema.contactPoint?.['@type']).toBe('ContactPoint');
    });

    it('should handle auth page breadcrumbs', () => {
      const loginBreadcrumbs = generateBreadcrumbsFromPath('/auth/login');
      expect(loginBreadcrumbs).toHaveLength(3);
      expect(loginBreadcrumbs[1]).toEqual({ name: 'Authentication', url: undefined });
      expect(loginBreadcrumbs[2]).toEqual({ name: 'Login', url: undefined });

      const signupBreadcrumbs = generateBreadcrumbsFromPath('/auth/signup');
      expect(signupBreadcrumbs[2]).toEqual({ name: 'Sign Up', url: undefined });
    });

    it('should handle dashboard breadcrumbs', () => {
      const breadcrumbs = generateBreadcrumbsFromPath('/dashboard');

      expect(breadcrumbs).toHaveLength(2);
      expect(breadcrumbs[0]).toEqual({ name: 'Home', url: '/' });
      expect(breadcrumbs[1]).toEqual({ name: 'Dashboard', url: '/dashboard' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle tracks without prices', () => {
      const freeTrack = {
        ...mockTrack,
        price_cents: undefined,
      };

      const schema = generateTrackPageSchema(freeTrack);
      expect(schema.audioObject.offers).toBeUndefined();
      expect(schema.product).toBeNull();
    });

    it('should handle profiles without full names', () => {
      const trackWithUsername = {
        ...mockTrack,
        profiles: {
          ...mockTrack.profiles,
          full_name: undefined,
        },
      };

      const schema = generateTrackPageSchema(trackWithUsername);
      expect(schema.audioObject.author?.name).toBe('johndoe');
    });

    it('should handle empty playlists', () => {
      const emptyPlaylist = {
        ...mockPlaylist,
        playlist_tracks: [],
      };

      const schema = generatePlaylistPageSchema(emptyPlaylist);
      expect(schema.musicPlaylist.numTracks).toBe(0);
      expect(schema.musicPlaylist.track).toEqual([]);
    });

    it('should handle complex nested paths', () => {
      const breadcrumbs = generateBreadcrumbsFromPath('/marketplace/category/meditation/advanced/deep-focus');

      expect(breadcrumbs.length).toBeGreaterThan(3);
      expect(breadcrumbs[0]).toEqual({ name: 'Home', url: '/' });
      expect(breadcrumbs[1]).toEqual({ name: 'Marketplace', url: '/marketplace' });
    });
  });
});

// Mock track data for testing
const mockTrack = {
  id: 'track-123',
  title: 'Morning Meditation',
  description: 'A peaceful morning meditation to start your day',
  duration_seconds: 600,
  price_cents: 999,
  audio_url: 'https://cdn.mindscript.app/audio/track-123.mp3',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  play_count: 100,
  profiles: {
    id: 'user-123',
    username: 'johndoe',
    full_name: 'John Doe',
    avatar_url: 'https://cdn.mindscript.app/avatars/johndoe.jpg',
    bio: 'Meditation instructor',
  },
};

// Mock playlist data for testing
const mockPlaylist = {
  id: 'playlist-456',
  title: 'Sleep Collection',
  description: 'Curated tracks for better sleep',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  profiles: {
    username: 'curator',
    full_name: 'The Curator',
  },
  playlist_tracks: [
    {
      tracks: {
        id: 'track-1',
        title: 'Sleep Track 1',
        description: '',
        duration_seconds: 300,
        price_cents: 0,
        audio_url: 'https://cdn.mindscript.app/audio/track-1.mp3',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        play_count: 0,
        profiles: {
          id: 'user-1',
          username: 'artist1',
          full_name: 'Artist One',
          avatar_url: '',
          bio: '',
        },
      },
    },
  ],
};
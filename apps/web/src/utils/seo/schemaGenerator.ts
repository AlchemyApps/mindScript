import {
  generateAudioObjectJsonLd,
  generatePersonJsonLd,
  generateMusicPlaylistJsonLd,
  generateProductJsonLd,
  generateOrganizationJsonLd,
  formatDurationToISO8601,
} from '@mindscript/seo';

interface TrackData {
  id: string;
  title: string;
  description?: string;
  duration_seconds?: number;
  price_cents?: number;
  audio_url?: string;
  created_at: string;
  updated_at: string;
  play_count?: number;
  profiles: {
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
    bio?: string;
  };
}

interface PlaylistData {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    full_name?: string;
  };
  playlist_tracks: Array<{
    tracks: TrackData;
  }>;
}

/**
 * Generate complete structured data for a track page
 */
export function generateTrackPageSchema(track: TrackData, baseUrl: string = 'https://mindscript.app') {
  const trackUrl = `${baseUrl}/u/${track.profiles.username}/${track.id}`;
  const sellerUrl = `${baseUrl}/u/${track.profiles.username}`;

  // Generate AudioObject schema
  const audioObject = generateAudioObjectJsonLd({
    name: track.title,
    description: track.description,
    url: trackUrl,
    contentUrl: track.audio_url || `${baseUrl}/api/audio/stream/${track.id}`,
    duration: track.duration_seconds ? formatDurationToISO8601(track.duration_seconds) : 'PT0S',
    author: {
      name: track.profiles.full_name || track.profiles.username,
      url: sellerUrl,
    },
    datePublished: track.created_at,
    dateModified: track.updated_at,
    price: track.price_cents ? track.price_cents / 100 : undefined,
    priceCurrency: 'USD',
    thumbnailUrl: `${baseUrl}/api/og?title=${encodeURIComponent(track.title)}&author=${encodeURIComponent(
      track.profiles.username
    )}`,
  });

  // Generate Person schema for the seller
  const person = generatePersonJsonLd({
    name: track.profiles.full_name || track.profiles.username,
    url: sellerUrl,
    image: track.profiles.avatar_url,
    description: track.profiles.bio,
  });

  // Generate Product schema if track has a price
  const product = track.price_cents
    ? generateProductJsonLd({
        name: track.title,
        description: track.description,
        url: trackUrl,
        image: `${baseUrl}/api/og?title=${encodeURIComponent(track.title)}`,
        price: track.price_cents / 100,
        priceCurrency: 'USD',
        availability: 'InStock',
        category: 'Meditation Audio',
      })
    : null;

  return {
    audioObject,
    person,
    product,
  };
}

/**
 * Generate complete structured data for a playlist page
 */
export function generatePlaylistPageSchema(playlist: PlaylistData, baseUrl: string = 'https://mindscript.app') {
  const playlistUrl = `${baseUrl}/playlists/${playlist.id}`;
  const creatorUrl = `${baseUrl}/u/${playlist.profiles.username}`;

  // Convert playlist tracks to schema format
  const tracks = playlist.playlist_tracks && playlist.playlist_tracks.length > 0
    ? playlist.playlist_tracks.map(({ tracks: track }) => ({
        name: track.title,
        url: `${baseUrl}/u/${track.profiles.username}/${track.id}`,
        contentUrl: track.audio_url || `${baseUrl}/api/audio/stream/${track.id}`,
        duration: track.duration_seconds ? formatDurationToISO8601(track.duration_seconds) : 'PT0S',
      }))
    : [];

  // Generate MusicPlaylist schema
  const musicPlaylist = generateMusicPlaylistJsonLd({
    name: playlist.title,
    description: playlist.description,
    url: playlistUrl,
    numTracks: playlist.playlist_tracks.length,
    author: {
      name: playlist.profiles.full_name || playlist.profiles.username,
      url: creatorUrl,
    },
    datePublished: playlist.created_at,
    tracks,
    thumbnailUrl: `${baseUrl}/api/og?title=${encodeURIComponent(playlist.title)}&type=playlist`,
  });

  // Generate Person schema for the creator
  const person = generatePersonJsonLd({
    name: playlist.profiles.full_name || playlist.profiles.username,
    url: creatorUrl,
  });

  return {
    musicPlaylist,
    person,
  };
}

/**
 * Generate organization schema for the main site
 */
export function generateSiteOrganizationSchema(baseUrl: string = 'https://mindscript.app') {
  return generateOrganizationJsonLd({
    name: 'MindScript',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'AI-powered meditation and affirmation platform for mindfulness and personal growth',
    sameAs: [
      'https://twitter.com/mindscript',
      'https://facebook.com/mindscript',
      'https://instagram.com/mindscript',
    ],
    contactPoint: {
      contactType: 'customer support',
      email: 'support@mindscript.app',
    },
  });
}

/**
 * Generate WebSite schema with search action
 */
export function generateWebSiteSchema(baseUrl: string = 'https://mindscript.app') {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MindScript',
    url: baseUrl,
    description: 'Transform your mindset with AI-powered meditations and affirmations',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/marketplace/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
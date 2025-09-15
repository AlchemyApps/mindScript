import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateSitemap, generateSitemapIndex, splitIntoSitemaps, formatSitemapDate, type SitemapUrl } from '@mindscript/seo';

// Base URL for the application
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mindscript.app';

// Maximum URLs per sitemap
const MAX_URLS_PER_SITEMAP = 50000;

// Cache duration in seconds (1 hour)
const CACHE_DURATION = 3600;

interface TrackData {
  id: string;
  user_id: string;
  title: string;
  updated_at: string;
  profiles: {
    username: string;
  };
}

interface ProfileData {
  id: string;
  username: string;
  updated_at: string;
}

interface PlaylistData {
  id: string;
  title: string;
  updated_at: string;
  user_id: string;
  profiles: {
    username: string;
  };
}

async function getStaticUrls(): Promise<SitemapUrl[]> {
  const now = new Date().toISOString().split('T')[0];

  return [
    // Homepage
    {
      loc: '/',
      changefreq: 'daily' as const,
      priority: 1.0,
      lastmod: now,
    },
    // Marketplace
    {
      loc: '/marketplace',
      changefreq: 'hourly' as const,
      priority: 0.9,
      lastmod: now,
    },
    // Auth pages
    {
      loc: '/auth/login',
      changefreq: 'monthly' as const,
      priority: 0.5,
      lastmod: now,
    },
    {
      loc: '/auth/signup',
      changefreq: 'monthly' as const,
      priority: 0.5,
      lastmod: now,
    },
    // Legal pages
    {
      loc: '/privacy',
      changefreq: 'monthly' as const,
      priority: 0.3,
      lastmod: now,
    },
    {
      loc: '/terms',
      changefreq: 'monthly' as const,
      priority: 0.3,
      lastmod: now,
    },
    // About pages
    {
      loc: '/about',
      changefreq: 'weekly' as const,
      priority: 0.6,
      lastmod: now,
    },
    {
      loc: '/contact',
      changefreq: 'monthly' as const,
      priority: 0.4,
      lastmod: now,
    },
  ];
}

async function getPublicTracks(supabase: any): Promise<SitemapUrl[]> {
  try {
    const { data: tracks, error } = await supabase
      .from('tracks')
      .select(`
        id,
        user_id,
        title,
        updated_at,
        profiles!inner (
          username
        )
      `)
      .eq('is_public', true)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(10000); // Limit to prevent massive sitemaps

    if (error || !tracks) {
      console.error('Error fetching tracks:', error);
      return [];
    }

    return (tracks as TrackData[]).map(track => ({
      loc: `/u/${track.profiles.username}/${track.id}`,
      changefreq: 'weekly' as const,
      priority: 0.7,
      lastmod: formatSitemapDate(new Date(track.updated_at)),
    }));
  } catch (error) {
    console.error('Error in getPublicTracks:', error);
    return [];
  }
}

async function getSellerProfiles(supabase: any): Promise<SitemapUrl[]> {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, updated_at')
      .not('username', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5000); // Limit seller profiles

    if (error || !profiles) {
      console.error('Error fetching profiles:', error);
      return [];
    }

    return (profiles as ProfileData[]).map(profile => ({
      loc: `/u/${profile.username}`,
      changefreq: 'weekly' as const,
      priority: 0.6,
      lastmod: formatSitemapDate(new Date(profile.updated_at)),
    }));
  } catch (error) {
    console.error('Error in getSellerProfiles:', error);
    return [];
  }
}

async function getPublicPlaylists(supabase: any): Promise<SitemapUrl[]> {
  try {
    const { data: playlists, error } = await supabase
      .from('playlists')
      .select(`
        id,
        title,
        updated_at,
        user_id,
        profiles!inner (
          username
        )
      `)
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(5000); // Limit playlists

    if (error || !playlists) {
      console.error('Error fetching playlists:', error);
      return [];
    }

    return (playlists as PlaylistData[]).map(playlist => ({
      loc: `/playlists/${playlist.id}`,
      changefreq: 'weekly' as const,
      priority: 0.5,
      lastmod: formatSitemapDate(new Date(playlist.updated_at)),
    }));
  } catch (error) {
    console.error('Error in getPublicPlaylists:', error);
    return [];
  }
}

async function getMarketplaceCategories(): Promise<SitemapUrl[]> {
  // Static marketplace category pages
  const categories = [
    'meditation',
    'affirmations',
    'sleep',
    'focus',
    'relaxation',
    'healing',
    'manifestation',
    'breathing',
  ];

  return categories.map(category => ({
    loc: `/marketplace/category/${category}`,
    changefreq: 'daily' as const,
    priority: 0.8,
    lastmod: formatSitemapDate(new Date()),
  }));
}

export async function GET(request: Request) {
  try {
    // Check if this is a request for a specific sitemap (e.g., sitemap-1.xml)
    const url = new URL(request.url);
    const pathname = url.pathname;
    const sitemapMatch = pathname.match(/sitemap-(\d+)\.xml$/);

    const supabase = createClient();

    // Gather all URLs
    const [staticUrls, tracks, profiles, playlists, categories] = await Promise.all([
      getStaticUrls(),
      getPublicTracks(supabase),
      getSellerProfiles(supabase),
      getPublicPlaylists(supabase),
      getMarketplaceCategories(),
    ]);

    const allUrls = [...staticUrls, ...tracks, ...profiles, ...playlists, ...categories];

    // If more than MAX_URLS_PER_SITEMAP, create sitemap index
    if (allUrls.length > MAX_URLS_PER_SITEMAP) {
      const sitemapGroups = splitIntoSitemaps(allUrls, MAX_URLS_PER_SITEMAP);

      if (sitemapMatch) {
        // Return specific sitemap
        const sitemapIndex = parseInt(sitemapMatch[1], 10) - 1;
        if (sitemapIndex >= 0 && sitemapIndex < sitemapGroups.length) {
          const xml = generateSitemap({
            urls: sitemapGroups[sitemapIndex],
            baseUrl: BASE_URL,
          });

          return new NextResponse(xml, {
            status: 200,
            headers: {
              'Content-Type': 'application/xml',
              'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`,
            },
          });
        }
      }

      // Return sitemap index
      const sitemapEntries = sitemapGroups.map((_, index) => ({
        loc: `${BASE_URL}/sitemap-${index + 1}.xml`,
        lastmod: formatSitemapDate(new Date()),
      }));

      const xml = generateSitemapIndex(sitemapEntries);

      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`,
        },
      });
    }

    // Generate single sitemap
    const xml = generateSitemap({
      urls: allUrls,
      baseUrl: BASE_URL,
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`,
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);

    // Return a minimal sitemap on error
    const fallbackUrls: SitemapUrl[] = [
      {
        loc: '/',
        changefreq: 'daily',
        priority: 1.0,
      },
      {
        loc: '/marketplace',
        changefreq: 'daily',
        priority: 0.9,
      },
    ];

    const xml = generateSitemap({
      urls: fallbackUrls,
      baseUrl: BASE_URL,
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=300', // Shorter cache on error
      },
    });
  }
}
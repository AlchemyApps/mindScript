import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mindscript.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/marketplace`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/auth/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/auth/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Fetch all active sellers with published tracks
  const { data: sellers } = await supabase
    .from('profiles')
    .select(`
      username,
      updated_at,
      tracks!inner(
        id,
        status
      )
    `)
    .eq('account_status', 'active')
    .eq('tracks.status', 'published')
    .eq('tracks.is_public', true)
    .not('username', 'is', null);

  // Generate seller profile URLs
  const sellerPages: MetadataRoute.Sitemap = sellers?.map((seller) => ({
    url: `${SITE_URL}/u/${seller.username}`,
    lastModified: new Date(seller.updated_at),
    changeFrequency: 'weekly',
    priority: 0.8,
  })) || [];

  // Fetch all published tracks with their sellers
  const { data: tracks } = await supabase
    .from('tracks')
    .select(`
      title,
      updated_at,
      created_at,
      play_count,
      user_id,
      profiles!inner(
        username
      )
    `)
    .eq('status', 'published')
    .eq('is_public', true)
    .order('play_count', { ascending: false })
    .limit(1000); // Limit to top 1000 tracks for performance

  // Generate track URLs
  const trackPages: MetadataRoute.Sitemap = tracks?.map((track: any) => {
    const trackSlug = track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Calculate priority based on popularity (play count)
    let priority = 0.6;
    if (track.play_count > 10000) priority = 0.8;
    else if (track.play_count > 1000) priority = 0.7;

    const profile = Array.isArray(track.profiles) ? track.profiles[0] : track.profiles;

    return {
      url: `${SITE_URL}/u/${profile?.username}/${trackSlug}`,
      lastModified: new Date(track.updated_at || track.created_at),
      changeFrequency: 'weekly' as const,
      priority,
    };
  }) || [];

  // Combine all pages
  return [...staticPages, ...sellerPages, ...trackPages];
}


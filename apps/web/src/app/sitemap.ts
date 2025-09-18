import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mindscript.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

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
  const trackPages: MetadataRoute.Sitemap = tracks?.map((track) => {
    const trackSlug = track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Calculate priority based on popularity (play count)
    let priority = 0.6;
    if (track.play_count > 10000) priority = 0.8;
    else if (track.play_count > 1000) priority = 0.7;

    return {
      url: `${SITE_URL}/u/${track.profiles.username}/${trackSlug}`,
      lastModified: new Date(track.updated_at || track.created_at),
      changeFrequency: 'weekly' as const,
      priority,
    };
  }) || [];

  // Combine all pages
  return [...staticPages, ...sellerPages, ...trackPages];
}

// Alternative XML format for better compatibility
export async function GET() {
  const supabase = await createClient();

  const staticUrls = [
    { url: SITE_URL, priority: '1.0', changefreq: 'daily' },
    { url: `${SITE_URL}/marketplace`, priority: '0.9', changefreq: 'hourly' },
    { url: `${SITE_URL}/auth/login`, priority: '0.5', changefreq: 'monthly' },
    { url: `${SITE_URL}/auth/signup`, priority: '0.5', changefreq: 'monthly' },
  ];

  // Fetch sellers and tracks
  const { data: sellers } = await supabase
    .from('profiles')
    .select('username, updated_at')
    .eq('account_status', 'active')
    .not('username', 'is', null);

  const { data: tracks } = await supabase
    .from('tracks')
    .select(`
      title,
      updated_at,
      play_count,
      profiles!inner(username)
    `)
    .eq('status', 'published')
    .eq('is_public', true)
    .limit(1000);

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Add static URLs
  for (const page of staticUrls) {
    xml += '  <url>\n';
    xml += `    <loc>${page.url}</loc>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '  </url>\n';
  }

  // Add seller URLs
  if (sellers) {
    for (const seller of sellers) {
      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}/u/${seller.username}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `    <lastmod>${new Date(seller.updated_at).toISOString()}</lastmod>\n`;
      xml += '  </url>\n';
    }
  }

  // Add track URLs
  if (tracks) {
    for (const track of tracks) {
      const trackSlug = track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const priority = track.play_count > 10000 ? '0.8' : track.play_count > 1000 ? '0.7' : '0.6';

      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}/u/${track.profiles.username}/${trackSlug}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      xml += `    <lastmod>${new Date(track.updated_at).toISOString()}</lastmod>\n`;
      xml += '  </url>\n';
    }
  }

  xml += '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
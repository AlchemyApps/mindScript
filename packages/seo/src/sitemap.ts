export interface SitemapImage {
  loc: string;
  title?: string;
  caption?: string;
  geo_location?: string;
  license?: string;
}

export interface SitemapVideo {
  thumbnail_loc: string;
  title: string;
  description: string;
  content_loc?: string;
  player_loc?: string;
  duration?: number; // in seconds
  expiration_date?: string;
  rating?: number;
  view_count?: number;
  publication_date?: string;
  family_friendly?: boolean;
  restriction?: {
    relationship: 'allow' | 'deny';
    countries: string;
  };
  platform?: {
    relationship: 'allow' | 'deny';
    platforms: string;
  };
  requires_subscription?: boolean;
  uploader?: {
    name: string;
    info?: string;
  };
  live?: boolean;
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: SitemapImage[];
  videos?: SitemapVideo[];
}

export interface SitemapConfig {
  urls: SitemapUrl[];
  baseUrl?: string;
  maxUrls?: number;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

const DEFAULT_BASE_URL = 'https://mindscript.studio';
const MAX_URLS_PER_SITEMAP = 50000;
const MAX_SITEMAP_SIZE_MB = 50;

// XML escape function
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date to W3C datetime format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS+TZ)
export function formatSitemapDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString().split('T')[0];
}

// Generate canonical URL
function generateCanonicalUrl(path: string, baseUrl: string = DEFAULT_BASE_URL): string {
  // If the path is already an absolute URL, return it
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Ensure base URL doesn't end with a slash
  const base = baseUrl.replace(/\/$/, '');

  // Ensure path starts with a slash
  const cleanPath = path.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
  const finalPath = cleanPath ? `/${cleanPath}` : '';

  return `${base}${finalPath}`;
}

export function generateSitemapUrl(url: SitemapUrl): SitemapUrl {
  return {
    loc: url.loc,
    ...(url.lastmod && { lastmod: url.lastmod }),
    ...(url.changefreq && { changefreq: url.changefreq }),
    ...(url.priority !== undefined && { priority: url.priority }),
    ...(url.images && { images: url.images }),
    ...(url.videos && { videos: url.videos }),
  };
}

function generateImageXml(image: SitemapImage): string {
  const parts: string[] = ['    <image:image>'];
  parts.push(`      <image:loc>${escapeXml(image.loc)}</image:loc>`);

  if (image.title) {
    parts.push(`      <image:title>${escapeXml(image.title)}</image:title>`);
  }
  if (image.caption) {
    parts.push(`      <image:caption>${escapeXml(image.caption)}</image:caption>`);
  }
  if (image.geo_location) {
    parts.push(`      <image:geo_location>${escapeXml(image.geo_location)}</image:geo_location>`);
  }
  if (image.license) {
    parts.push(`      <image:license>${escapeXml(image.license)}</image:license>`);
  }

  parts.push('    </image:image>');
  return parts.join('\n');
}

function generateVideoXml(video: SitemapVideo): string {
  const parts: string[] = ['    <video:video>'];

  parts.push(`      <video:thumbnail_loc>${escapeXml(video.thumbnail_loc)}</video:thumbnail_loc>`);
  parts.push(`      <video:title>${escapeXml(video.title)}</video:title>`);
  parts.push(`      <video:description>${escapeXml(video.description)}</video:description>`);

  if (video.content_loc) {
    parts.push(`      <video:content_loc>${escapeXml(video.content_loc)}</video:content_loc>`);
  }
  if (video.player_loc) {
    parts.push(`      <video:player_loc>${escapeXml(video.player_loc)}</video:player_loc>`);
  }
  if (video.duration !== undefined) {
    parts.push(`      <video:duration>${video.duration}</video:duration>`);
  }
  if (video.expiration_date) {
    parts.push(`      <video:expiration_date>${escapeXml(video.expiration_date)}</video:expiration_date>`);
  }
  if (video.rating !== undefined) {
    parts.push(`      <video:rating>${video.rating}</video:rating>`);
  }
  if (video.view_count !== undefined) {
    parts.push(`      <video:view_count>${video.view_count}</video:view_count>`);
  }
  if (video.publication_date) {
    parts.push(`      <video:publication_date>${escapeXml(video.publication_date)}</video:publication_date>`);
  }
  if (video.family_friendly !== undefined) {
    parts.push(`      <video:family_friendly>${video.family_friendly ? 'yes' : 'no'}</video:family_friendly>`);
  }
  if (video.restriction) {
    parts.push(`      <video:restriction relationship="${video.restriction.relationship}">${escapeXml(video.restriction.countries)}</video:restriction>`);
  }
  if (video.platform) {
    parts.push(`      <video:platform relationship="${video.platform.relationship}">${escapeXml(video.platform.platforms)}</video:platform>`);
  }
  if (video.requires_subscription !== undefined) {
    parts.push(`      <video:requires_subscription>${video.requires_subscription ? 'yes' : 'no'}</video:requires_subscription>`);
  }
  if (video.uploader) {
    parts.push(`      <video:uploader info="${video.uploader.info || ''}">${escapeXml(video.uploader.name)}</video:uploader>`);
  }
  if (video.live !== undefined) {
    parts.push(`      <video:live>${video.live ? 'yes' : 'no'}</video:live>`);
  }

  parts.push('    </video:video>');
  return parts.join('\n');
}

export function generateSitemap(config: SitemapConfig): string {
  const { urls, baseUrl = DEFAULT_BASE_URL, maxUrls = MAX_URLS_PER_SITEMAP } = config;

  // Limit URLs to maxUrls
  const limitedUrls = urls.slice(0, maxUrls);

  // Check if we need image or video namespaces
  const hasImages = limitedUrls.some(url => url.images && url.images.length > 0);
  const hasVideos = limitedUrls.some(url => url.videos && url.videos.length > 0);

  // Build namespace declarations
  const namespaces: string[] = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  ];

  if (hasImages) {
    namespaces.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  }

  if (hasVideos) {
    namespaces.push('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
  }

  // Start building the XML
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset ${namespaces.join(' ')}>`,
  ];

  // Add each URL
  for (const url of limitedUrls) {
    const canonicalUrl = generateCanonicalUrl(url.loc, baseUrl);

    parts.push('  <url>');
    parts.push(`    <loc>${escapeXml(canonicalUrl)}</loc>`);

    if (url.lastmod) {
      parts.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
    }

    if (url.changefreq) {
      parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
    }

    if (url.priority !== undefined) {
      // Format priority to always show decimal point
      const priorityStr = Number.isInteger(url.priority) ? `${url.priority}.0` : url.priority.toString();
      parts.push(`    <priority>${priorityStr}</priority>`);
    }

    // Add images
    if (url.images) {
      for (const image of url.images) {
        parts.push(generateImageXml(image));
      }
    }

    // Add videos
    if (url.videos) {
      for (const video of url.videos) {
        parts.push(generateVideoXml(video));
      }
    }

    parts.push('  </url>');
  }

  parts.push('</urlset>');

  return parts.join('\n');
}

export function generateSitemapIndex(sitemaps: SitemapIndexEntry[]): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const sitemap of sitemaps) {
    parts.push('  <sitemap>');
    parts.push(`    <loc>${escapeXml(sitemap.loc)}</loc>`);

    if (sitemap.lastmod) {
      parts.push(`    <lastmod>${escapeXml(sitemap.lastmod)}</lastmod>`);
    }

    parts.push('  </sitemap>');
  }

  parts.push('</sitemapindex>');

  return parts.join('\n');
}

// Helper to split URLs into multiple sitemaps if needed
export function splitIntoSitemaps(urls: SitemapUrl[], maxUrlsPerSitemap: number = MAX_URLS_PER_SITEMAP): SitemapUrl[][] {
  const sitemaps: SitemapUrl[][] = [];

  for (let i = 0; i < urls.length; i += maxUrlsPerSitemap) {
    sitemaps.push(urls.slice(i, i + maxUrlsPerSitemap));
  }

  return sitemaps;
}

// Helper to generate robots.txt content
export function generateRobotsTxt(params: {
  sitemapUrl?: string;
  disallowPaths?: string[];
  allowPaths?: string[];
  userAgent?: string;
  crawlDelay?: number;
  host?: string;
}): string {
  const lines: string[] = [];
  const userAgent = params.userAgent || '*';

  lines.push(`User-agent: ${userAgent}`);

  if (params.crawlDelay !== undefined) {
    lines.push(`Crawl-delay: ${params.crawlDelay}`);
  }

  // Add allow paths first (more specific)
  if (params.allowPaths) {
    for (const path of params.allowPaths) {
      lines.push(`Allow: ${path}`);
    }
  }

  // Add disallow paths
  if (params.disallowPaths) {
    for (const path of params.disallowPaths) {
      lines.push(`Disallow: ${path}`);
    }
  } else {
    // Default: allow all
    lines.push('Disallow:');
  }

  // Add host
  if (params.host) {
    lines.push('');
    lines.push(`Host: ${params.host}`);
  }

  // Add sitemap
  if (params.sitemapUrl) {
    lines.push('');
    lines.push(`Sitemap: ${params.sitemapUrl}`);
  }

  return lines.join('\n');
}
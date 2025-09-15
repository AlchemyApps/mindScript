import { NextResponse } from 'next/server';
import { generateRobotsTxt } from '@mindscript/seo';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mindscript.app';

export async function GET() {
  const robotsTxt = generateRobotsTxt({
    sitemapUrl: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
    userAgent: '*',
    disallowPaths: [
      '/api/',
      '/dashboard/',
      '/admin/',
      '/checkout/',
      '/auth/callback',
      '/auth/confirm',
      '/*.json$',
      '/*?*', // URLs with query parameters
      '/404',
      '/500',
    ],
    allowPaths: [
      '/api/og', // Allow OG image generation
    ],
    crawlDelay: undefined, // No crawl delay for general crawlers
  });

  // Add specific rules for different crawlers
  const additionalRules = `

# Google
User-agent: Googlebot
Allow: /
Crawl-delay: 0

# OpenAI GPT Bot
User-agent: GPTBot
Allow: /
Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/

# Common crawlers to block
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: MJ12bot
Disallow: /

# Allow all images
User-agent: Googlebot-Image
Allow: /

# Allow all videos
User-agent: Googlebot-Video
Allow: /`;

  const fullRobotsTxt = robotsTxt + additionalRules;

  return new NextResponse(fullRobotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate', // Cache for 24 hours
    },
  });
}
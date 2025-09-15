import { Metadata } from 'next';
import {
  generateMetaTags,
  generateOpenGraphTags,
  generateTwitterTags,
  generateCanonicalUrl,
  type MetaTagsConfig,
  type OpenGraphConfig,
  type TwitterConfig,
} from '@mindscript/seo';

const DEFAULT_SITE_NAME = 'MindScript';
const DEFAULT_TWITTER_SITE = '@mindscript';
const DEFAULT_OG_IMAGE = 'https://mindscript.app/og-default.jpg';

interface GenerateMetadataParams {
  title: string;
  description?: string;
  keywords?: string[];
  url?: string;
  image?: string;
  author?: string;
  type?: OpenGraphConfig['type'];
  twitterCard?: TwitterConfig['card'];
  twitterCreator?: string;
  noindex?: boolean;
  // Music-specific metadata
  musicDuration?: number;
  musicAlbum?: string;
  musicMusician?: string;
  musicReleaseDate?: string;
  // Article-specific metadata
  articleAuthor?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleSection?: string;
  articleTag?: string[];
}

/**
 * Generate Next.js 14 Metadata object with SEO optimizations
 */
export function generateMetadata(params: GenerateMetadataParams): Metadata {
  const {
    title,
    description,
    keywords,
    url = '/',
    image = DEFAULT_OG_IMAGE,
    author,
    type = 'website',
    twitterCard = 'summary_large_image',
    twitterCreator,
    noindex = false,
    ...additionalParams
  } = params;

  const canonicalUrl = generateCanonicalUrl(url);

  // Generate base meta tags
  const metaTags = generateMetaTags({
    title,
    description,
    keywords,
    author,
    robots: noindex ? 'noindex,nofollow' : 'index,follow',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
  });

  // Generate OpenGraph tags
  const openGraphTags = generateOpenGraphTags({
    title,
    description,
    url: canonicalUrl,
    image,
    type,
    siteName: DEFAULT_SITE_NAME,
    locale: 'en_US',
    ...additionalParams,
  });

  // Generate Twitter tags
  const twitterTags = generateTwitterTags({
    card: twitterCard,
    title,
    description,
    image,
    site: DEFAULT_TWITTER_SITE,
    creator: twitterCreator,
  });

  // Convert to Next.js Metadata format
  const metadata: Metadata = {
    title: metaTags.title,
    description: metaTags.description,
    keywords: metaTags.keywords,
    authors: author ? [{ name: author }] : undefined,
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: {
        index: !noindex,
        follow: !noindex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: openGraphTags['og:title'],
      description: openGraphTags['og:description'],
      url: openGraphTags['og:url'],
      siteName: openGraphTags['og:site_name'],
      locale: openGraphTags['og:locale'],
      type: openGraphTags['og:type'] as any,
      images: openGraphTags['og:image']
        ? [
            {
              url: openGraphTags['og:image'],
              width: openGraphTags['og:image:width'] as number | undefined,
              height: openGraphTags['og:image:height'] as number | undefined,
              alt: openGraphTags['og:image:alt'] as string | undefined,
            },
          ]
        : undefined,
      audio: openGraphTags['og:audio'] ? [{ url: openGraphTags['og:audio'] }] : undefined,
      videos: openGraphTags['og:video'] ? [{ url: openGraphTags['og:video'] }] : undefined,
    },
    twitter: {
      card: twitterTags['twitter:card'] as any,
      title: twitterTags['twitter:title'],
      description: twitterTags['twitter:description'],
      site: twitterTags['twitter:site'],
      creator: twitterTags['twitter:creator'],
      images: twitterTags['twitter:image'] ? [twitterTags['twitter:image']] : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    metadataBase: new URL('https://mindscript.app'),
  };

  return metadata;
}

/**
 * Generate metadata for an audio track page
 */
export function generateTrackMetadata(params: {
  title: string;
  description?: string;
  sellerName: string;
  sellerUsername: string;
  trackId: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  price?: number;
  publishedAt?: string;
  modifiedAt?: string;
}): Metadata {
  const url = `/u/${params.sellerUsername}/${params.trackId}`;
  const title = `${params.title} by ${params.sellerName} | MindScript`;

  return generateMetadata({
    title,
    description: params.description || `Listen to ${params.title}, a meditation track by ${params.sellerName} on MindScript.`,
    url,
    image: params.imageUrl,
    type: 'music.song',
    author: params.sellerName,
    twitterCreator: `@${params.sellerUsername}`,
    musicDuration: params.duration,
    musicMusician: params.sellerName,
    articlePublishedTime: params.publishedAt,
    articleModifiedTime: params.modifiedAt,
  });
}

/**
 * Generate metadata for a seller profile page
 */
export function generateSellerMetadata(params: {
  name: string;
  username: string;
  bio?: string;
  imageUrl?: string;
  trackCount?: number;
}): Metadata {
  const url = `/u/${params.username}`;
  const title = `${params.name} | MindScript Creator`;
  const description =
    params.bio ||
    `Explore ${params.trackCount || ''} meditation tracks by ${params.name} on MindScript. Transform your mindset with AI-powered affirmations and meditations.`;

  return generateMetadata({
    title,
    description,
    url,
    image: params.imageUrl,
    type: 'profile',
    author: params.name,
    twitterCreator: `@${params.username}`,
  });
}

/**
 * Generate metadata for a playlist page
 */
export function generatePlaylistMetadata(params: {
  title: string;
  description?: string;
  creatorName: string;
  playlistId: string;
  imageUrl?: string;
  trackCount?: number;
  publishedAt?: string;
}): Metadata {
  const url = `/playlists/${params.playlistId}`;
  const title = `${params.title} - Playlist by ${params.creatorName} | MindScript`;
  const description =
    params.description ||
    `Listen to ${params.title}, a curated playlist of ${params.trackCount || ''} meditation tracks by ${params.creatorName} on MindScript.`;

  return generateMetadata({
    title,
    description,
    url,
    image: params.imageUrl,
    type: 'music.playlist',
    author: params.creatorName,
    articlePublishedTime: params.publishedAt,
  });
}

/**
 * Generate metadata for marketplace category pages
 */
export function generateCategoryMetadata(params: {
  category: string;
  description?: string;
  trackCount?: number;
}): Metadata {
  const categoryTitle = params.category.charAt(0).toUpperCase() + params.category.slice(1);
  const url = `/marketplace/category/${params.category}`;
  const title = `${categoryTitle} Meditations | MindScript Marketplace`;
  const description =
    params.description ||
    `Discover ${params.trackCount || ''} ${categoryTitle.toLowerCase()} meditation and affirmation tracks on MindScript. Find the perfect audio for your mindfulness journey.`;

  return generateMetadata({
    title,
    description,
    url,
    keywords: [params.category, 'meditation', 'affirmations', 'mindfulness', 'audio', categoryTitle.toLowerCase()],
  });
}
import { z } from 'zod';

// Base Schema.org types
const BaseSchemaOrgSchema = z.object({
  '@context': z.literal('https://schema.org'),
});

// Person Schema
export const PersonSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('Person'),
  name: z.string(),
  url: z.string().url().optional(),
  image: z.string().url().optional(),
  description: z.string().optional(),
  sameAs: z.array(z.string().url()).optional(),
});

// Organization Schema
export const OrganizationSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('Organization'),
  name: z.string(),
  url: z.string().url(),
  logo: z.string().url().optional(),
  description: z.string().optional(),
  sameAs: z.array(z.string().url()).optional(),
  contactPoint: z
    .object({
      '@type': z.literal('ContactPoint'),
      telephone: z.string().optional(),
      contactType: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
});

// Offer Schema (for pricing)
export const OfferSchema = z.object({
  '@type': z.literal('Offer'),
  price: z.string(),
  priceCurrency: z.string(),
  availability: z.enum(['InStock', 'OutOfStock', 'PreOrder']).optional(),
  url: z.string().url().optional(),
});

// AudioObject Schema (for use in playlists without encoding format default)
const AudioObjectBaseSchema = z.object({
  '@type': z.literal('AudioObject'),
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  contentUrl: z.string().url(),
  duration: z.string(), // ISO 8601 duration format (e.g., "PT10M30S")
  encodingFormat: z.string().optional(),
  author: z.union([PersonSchema.omit({ '@context': true }), z.string()]).optional(),
  datePublished: z.string().optional(),
  dateModified: z.string().optional(),
  inLanguage: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  offers: OfferSchema.optional(),
  aggregateRating: z
    .object({
      '@type': z.literal('AggregateRating'),
      ratingValue: z.number(),
      ratingCount: z.number(),
      bestRating: z.number().optional(),
      worstRating: z.number().optional(),
    })
    .optional(),
});

// AudioObject Schema with context and default encoding
export const AudioObjectSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('AudioObject'),
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  contentUrl: z.string().url(),
  duration: z.string(), // ISO 8601 duration format (e.g., "PT10M30S")
  encodingFormat: z.string().default('audio/mpeg'),
  author: z.union([PersonSchema.omit({ '@context': true }), z.string()]).optional(),
  datePublished: z.string().optional(),
  dateModified: z.string().optional(),
  inLanguage: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  offers: OfferSchema.optional(),
  aggregateRating: z
    .object({
      '@type': z.literal('AggregateRating'),
      ratingValue: z.number(),
      ratingCount: z.number(),
      bestRating: z.number().optional(),
      worstRating: z.number().optional(),
    })
    .optional(),
});

// MusicPlaylist Schema
export const MusicPlaylistSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('MusicPlaylist'),
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  numTracks: z.number().optional(),
  author: z.union([PersonSchema.omit({ '@context': true }), z.string()]).optional(),
  datePublished: z.string().optional(),
  dateModified: z.string().optional(),
  track: z.array(AudioObjectBaseSchema).optional(),
  thumbnailUrl: z.string().url().optional(),
});

// Product Schema (for marketplace items)
export const ProductSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('Product'),
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  image: z.union([z.string().url(), z.array(z.string().url())]).optional(),
  brand: z.union([OrganizationSchema.omit({ '@context': true }), z.string()]).optional(),
  offers: z.union([OfferSchema, z.array(OfferSchema)]).optional(),
  aggregateRating: z
    .object({
      '@type': z.literal('AggregateRating'),
      ratingValue: z.number(),
      reviewCount: z.number(),
    })
    .optional(),
  category: z.string().optional(),
  keywords: z.string().optional(),
});

// BreadcrumbList Schema
export const BreadcrumbListSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('BreadcrumbList'),
  itemListElement: z.array(
    z.object({
      '@type': z.literal('ListItem'),
      position: z.number(),
      name: z.string(),
      item: z.string().url().optional(),
    })
  ),
});

// WebPage Schema
export const WebPageSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('WebPage'),
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url(),
  breadcrumb: BreadcrumbListSchema.omit({ '@context': true }).optional(),
  mainEntity: z.any().optional(),
  datePublished: z.string().optional(),
  dateModified: z.string().optional(),
  author: z.union([PersonSchema.omit({ '@context': true }), OrganizationSchema.omit({ '@context': true })]).optional(),
});

// WebSite Schema
export const WebSiteSchema = BaseSchemaOrgSchema.extend({
  '@type': z.literal('WebSite'),
  name: z.string(),
  url: z.string().url(),
  description: z.string().optional(),
  publisher: z.union([PersonSchema.omit({ '@context': true }), OrganizationSchema.omit({ '@context': true })]).optional(),
  potentialAction: z
    .object({
      '@type': z.literal('SearchAction'),
      target: z.object({
        '@type': z.literal('EntryPoint'),
        urlTemplate: z.string(),
      }),
      'query-input': z.string(),
    })
    .optional(),
});

// Type exports
export type Organization = z.infer<typeof OrganizationSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type AudioObject = z.infer<typeof AudioObjectSchema>;
export type MusicPlaylist = z.infer<typeof MusicPlaylistSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type BreadcrumbList = z.infer<typeof BreadcrumbListSchema>;
export type WebPage = z.infer<typeof WebPageSchema>;
export type WebSite = z.infer<typeof WebSiteSchema>;
export type Offer = z.infer<typeof OfferSchema>;

// Helper functions to generate JSON-LD

export function generateAudioObjectJsonLd(params: {
  name: string;
  description?: string;
  url: string;
  contentUrl: string;
  duration: string;
  author?: { name: string; url?: string };
  datePublished?: string;
  dateModified?: string;
  inLanguage?: string;
  thumbnailUrl?: string;
  price?: number;
  priceCurrency?: string;
  ratingValue?: number;
  ratingCount?: number;
}): AudioObject {
  const jsonLd: AudioObject = {
    '@context': 'https://schema.org',
    '@type': 'AudioObject',
    name: params.name,
    url: params.url,
    contentUrl: params.contentUrl,
    duration: params.duration,
    encodingFormat: 'audio/mpeg',
  };

  if (params.description) jsonLd.description = params.description;
  if (params.datePublished) jsonLd.datePublished = params.datePublished;
  if (params.dateModified) jsonLd.dateModified = params.dateModified;
  if (params.inLanguage) jsonLd.inLanguage = params.inLanguage;
  if (params.thumbnailUrl) jsonLd.thumbnailUrl = params.thumbnailUrl;

  if (params.author) {
    jsonLd.author = {
      '@type': 'Person',
      name: params.author.name,
      ...(params.author.url && { url: params.author.url }),
    };
  }

  if (params.price !== undefined && params.priceCurrency) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: params.price.toFixed(2),
      priceCurrency: params.priceCurrency,
    };
  }

  if (params.ratingValue !== undefined && params.ratingCount !== undefined) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: params.ratingValue,
      ratingCount: params.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return jsonLd;
}

export function generatePersonJsonLd(params: {
  name: string;
  url?: string;
  image?: string;
  description?: string;
  sameAs?: string[];
}): Person {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: params.name,
    ...(params.url && { url: params.url }),
    ...(params.image && { image: params.image }),
    ...(params.description && { description: params.description }),
    ...(params.sameAs && { sameAs: params.sameAs }),
  };
}

export function generateMusicPlaylistJsonLd(params: {
  name: string;
  description?: string;
  url: string;
  numTracks?: number;
  author?: { name: string; url?: string };
  datePublished?: string;
  tracks?: Array<{
    name: string;
    url: string;
    contentUrl: string;
    duration: string;
  }>;
  thumbnailUrl?: string;
}): MusicPlaylist {
  const jsonLd: MusicPlaylist = {
    '@context': 'https://schema.org',
    '@type': 'MusicPlaylist',
    name: params.name,
    url: params.url,
  };

  if (params.description) jsonLd.description = params.description;
  if (params.numTracks !== undefined) jsonLd.numTracks = params.numTracks;
  if (params.datePublished) jsonLd.datePublished = params.datePublished;
  if (params.thumbnailUrl) jsonLd.thumbnailUrl = params.thumbnailUrl;

  if (params.author) {
    jsonLd.author = {
      '@type': 'Person',
      name: params.author.name,
      ...(params.author.url && { url: params.author.url }),
    };
  }

  if (params.tracks) {
    jsonLd.track = params.tracks.length > 0
      ? params.tracks.map(track => ({
          '@type': 'AudioObject',
          name: track.name,
          url: track.url,
          contentUrl: track.contentUrl,
          duration: track.duration,
          encodingFormat: 'audio/mpeg',
        }))
      : [];
  }

  return jsonLd;
}

export function generateProductJsonLd(params: {
  name: string;
  description?: string;
  url: string;
  image?: string | string[];
  price?: number;
  priceCurrency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  ratingValue?: number;
  reviewCount?: number;
  category?: string;
  keywords?: string;
}): Product {
  const jsonLd: Product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: params.name,
    url: params.url,
  };

  if (params.description) jsonLd.description = params.description;
  if (params.image) jsonLd.image = params.image;
  if (params.category) jsonLd.category = params.category;
  if (params.keywords) jsonLd.keywords = params.keywords;

  if (params.price !== undefined && params.priceCurrency) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: params.price.toFixed(2),
      priceCurrency: params.priceCurrency,
      ...(params.availability && { availability: params.availability }),
    };
  }

  if (params.ratingValue !== undefined && params.reviewCount !== undefined) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: params.ratingValue,
      reviewCount: params.reviewCount,
    };
  }

  return jsonLd;
}

export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url?: string }>
): BreadcrumbList {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: item.name,
      ...(item.url && { item: item.url }),
    })),
  };
}

export function generateOrganizationJsonLd(params: {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  contactPoint?: {
    telephone?: string;
    contactType?: string;
    email?: string;
  };
}): Organization {
  const jsonLd: Organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: params.name,
    url: params.url,
  };

  if (params.logo) jsonLd.logo = params.logo;
  if (params.description) jsonLd.description = params.description;
  if (params.sameAs) jsonLd.sameAs = params.sameAs;

  if (params.contactPoint) {
    jsonLd.contactPoint = {
      '@type': 'ContactPoint',
      ...params.contactPoint,
    };
  }

  return jsonLd;
}

// Duration helpers
export function formatDurationToISO8601(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let duration = 'PT';
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  if (secs > 0) duration += `${secs}S`;

  return duration || 'PT0S';
}
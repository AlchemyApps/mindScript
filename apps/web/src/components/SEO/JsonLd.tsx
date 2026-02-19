'use client';

import React from 'react';
import {
  generateAudioObjectJsonLd,
  generatePersonJsonLd,
  generateMusicPlaylistJsonLd,
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  generateOrganizationJsonLd,
  type AudioObject,
  type Person,
  type MusicPlaylist,
  type Product,
  type BreadcrumbList,
  type Organization,
} from '@mindscript/seo';

interface JsonLdProps {
  data: Record<string, any>;
}

/**
 * Base JSON-LD component that renders structured data in a script tag
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface AudioObjectJsonLdProps {
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
}

/**
 * AudioObject schema component for audio tracks
 */
export function AudioObjectJsonLd(props: AudioObjectJsonLdProps) {
  const data = generateAudioObjectJsonLd(props);
  return <JsonLd data={data} />;
}

interface PersonJsonLdProps {
  name: string;
  url?: string;
  image?: string;
  description?: string;
  sameAs?: string[];
}

/**
 * Person schema component for user profiles
 */
export function PersonJsonLd(props: PersonJsonLdProps) {
  const data = generatePersonJsonLd(props);
  return <JsonLd data={data} />;
}

interface MusicPlaylistJsonLdProps {
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
}

/**
 * MusicPlaylist schema component for playlists
 */
export function MusicPlaylistJsonLd(props: MusicPlaylistJsonLdProps) {
  const data = generateMusicPlaylistJsonLd(props);
  return <JsonLd data={data} />;
}

interface ProductJsonLdProps {
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
}

/**
 * Product schema component for marketplace items
 */
export function ProductJsonLd(props: ProductJsonLdProps) {
  const data = generateProductJsonLd(props);
  return <JsonLd data={data} />;
}

interface BreadcrumbJsonLdProps {
  items: Array<{ name: string; url?: string }>;
}

/**
 * BreadcrumbList schema component for navigation
 */
export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = generateBreadcrumbJsonLd(items);
  return <JsonLd data={data} />;
}

interface OrganizationJsonLdProps {
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
}

/**
 * Organization schema component for the platform
 */
export function OrganizationJsonLd(props: OrganizationJsonLdProps) {
  const data = generateOrganizationJsonLd(props);
  return <JsonLd data={data} />;
}

// WebSite schema for search
interface WebSiteJsonLdProps {
  name: string;
  url: string;
  description?: string;
  searchUrl?: string;
}

export function WebSiteJsonLd({ name, url, description, searchUrl }: WebSiteJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    ...(description && { description }),
    ...(searchUrl && {
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: searchUrl,
        },
        'query-input': 'required name=search_term_string',
      },
    }),
  };

  return <JsonLd data={data} />;
}

// Article / BlogPosting schema
interface ArticleJsonLdProps {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: { name: string; url?: string };
  publisher?: { name: string; logo?: string };
  articleSection?: string;
  keywords?: string[];
  wordCount?: number;
  url: string;
}

export function ArticleJsonLd({
  headline,
  description,
  image,
  datePublished,
  dateModified,
  author,
  publisher = { name: 'MindScript', logo: 'https://mindscript.studio/images/logo-original.png' },
  articleSection,
  keywords,
  wordCount,
  url,
}: ArticleJsonLdProps) {
  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline,
    description,
    url,
    datePublished,
    ...(dateModified && { dateModified }),
    ...(image && { image }),
    author: {
      '@type': 'Person',
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    publisher: {
      '@type': 'Organization',
      name: publisher.name,
      ...(publisher.logo && {
        logo: { '@type': 'ImageObject', url: publisher.logo },
      }),
    },
    ...(articleSection && { articleSection }),
    ...(keywords?.length && { keywords: keywords.join(', ') }),
    ...(wordCount && { wordCount }),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return <JsonLd data={data} />;
}

// FAQPage schema — critical for AEO/GEO
interface FAQPageJsonLdProps {
  items: Array<{ question: string; answer: string }>;
}

export function FAQPageJsonLd({ items }: FAQPageJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return <JsonLd data={data} />;
}
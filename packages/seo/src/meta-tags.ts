export interface MetaTagsConfig {
  title: string;
  description?: string;
  keywords?: string[];
  author?: string;
  robots?: string;
  viewport?: string;
  charset?: string;
  themeColor?: string;
  generator?: string;
}

export interface OpenGraphConfig {
  title: string;
  description?: string;
  url: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  type?: 'website' | 'article' | 'music.song' | 'music.album' | 'music.playlist' | 'profile';
  siteName?: string;
  locale?: string;
  audio?: string;
  video?: string;
  // Music-specific properties
  musicDuration?: number;
  musicAlbum?: string;
  musicMusician?: string;
  musicReleaseDate?: string;
  // Article-specific properties
  articleAuthor?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleSection?: string;
  articleTag?: string[];
}

export interface TwitterConfig {
  card: 'summary' | 'summary_large_image' | 'player' | 'app';
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  site?: string; // @username
  creator?: string; // @username
  // Player card specific
  player?: string;
  playerWidth?: number;
  playerHeight?: number;
  playerStream?: string;
  // App card specific
  appName?: string;
  appIdIphone?: string;
  appIdIpad?: string;
  appIdGoogleplay?: string;
  appUrlIphone?: string;
  appUrlIpad?: string;
  appUrlGoogleplay?: string;
}

export interface HreflangConfig {
  url: string;
  languages: Array<{
    lang: string;
    url: string;
  }>;
  defaultLang?: string;
  baseUrl?: string;
}

export interface MetaTags {
  title: string;
  description?: string;
  keywords?: string;
  author?: string;
  robots?: string;
  viewport?: string;
  charset?: string;
  themeColor?: string;
  generator?: string;
  [key: string]: string | undefined;
}

export interface OpenGraphTags {
  'og:title': string;
  'og:description'?: string;
  'og:url': string;
  'og:image'?: string;
  'og:image:width'?: number;
  'og:image:height'?: number;
  'og:image:alt'?: string;
  'og:type'?: string;
  'og:site_name'?: string;
  'og:locale'?: string;
  'og:audio'?: string;
  'og:video'?: string;
  // Music properties
  'music:duration'?: number;
  'music:album'?: string;
  'music:musician'?: string;
  'music:release_date'?: string;
  // Article properties
  'article:author'?: string;
  'article:published_time'?: string;
  'article:modified_time'?: string;
  'article:section'?: string;
  'article:tag'?: string;
  [key: string]: string | number | undefined;
}

export interface TwitterTags {
  'twitter:card': string;
  'twitter:title'?: string;
  'twitter:description'?: string;
  'twitter:image'?: string;
  'twitter:image:alt'?: string;
  'twitter:site'?: string;
  'twitter:creator'?: string;
  // Player card
  'twitter:player'?: string;
  'twitter:player:width'?: number;
  'twitter:player:height'?: number;
  'twitter:player:stream'?: string;
  // App card
  'twitter:app:name:iphone'?: string;
  'twitter:app:id:iphone'?: string;
  'twitter:app:id:ipad'?: string;
  'twitter:app:id:googleplay'?: string;
  'twitter:app:url:iphone'?: string;
  'twitter:app:url:ipad'?: string;
  'twitter:app:url:googleplay'?: string;
  [key: string]: string | number | undefined;
}

export interface HreflangTag {
  hreflang: string;
  href: string;
}

// Default base URL for the application
const DEFAULT_BASE_URL = 'https://mindscript.app';

export function generateMetaTags(config: MetaTagsConfig): MetaTags {
  const tags: MetaTags = {
    title: config.title,
  };

  if (config.description) tags.description = config.description;
  if (config.keywords?.length) tags.keywords = config.keywords.join(', ');
  if (config.author) tags.author = config.author;
  if (config.robots) tags.robots = config.robots;
  if (config.viewport) tags.viewport = config.viewport;
  if (config.charset) tags.charset = config.charset;
  if (config.themeColor) tags.themeColor = config.themeColor;
  if (config.generator) tags.generator = config.generator;

  return tags;
}

export function generateOpenGraphTags(config: OpenGraphConfig): OpenGraphTags {
  const tags: OpenGraphTags = {
    'og:title': config.title,
    'og:url': config.url,
  };

  if (config.description) tags['og:description'] = config.description;
  if (config.image) tags['og:image'] = config.image;
  if (config.imageWidth) tags['og:image:width'] = config.imageWidth;
  if (config.imageHeight) tags['og:image:height'] = config.imageHeight;
  if (config.imageAlt) tags['og:image:alt'] = config.imageAlt;
  if (config.type) tags['og:type'] = config.type;
  if (config.siteName) tags['og:site_name'] = config.siteName;
  if (config.locale) tags['og:locale'] = config.locale;
  if (config.audio) tags['og:audio'] = config.audio;
  if (config.video) tags['og:video'] = config.video;

  // Music-specific properties
  if (config.type?.startsWith('music.')) {
    if (config.musicDuration) tags['music:duration'] = config.musicDuration;
    if (config.musicAlbum) tags['music:album'] = config.musicAlbum;
    if (config.musicMusician) tags['music:musician'] = config.musicMusician;
    if (config.musicReleaseDate) tags['music:release_date'] = config.musicReleaseDate;
  }

  // Article-specific properties
  if (config.type === 'article') {
    if (config.articleAuthor) tags['article:author'] = config.articleAuthor;
    if (config.articlePublishedTime) tags['article:published_time'] = config.articlePublishedTime;
    if (config.articleModifiedTime) tags['article:modified_time'] = config.articleModifiedTime;
    if (config.articleSection) tags['article:section'] = config.articleSection;
    if (config.articleTag?.length) {
      tags['article:tag'] = config.articleTag.join(',');
    }
  }

  return tags;
}

export function generateTwitterTags(config: TwitterConfig): TwitterTags {
  const tags: TwitterTags = {
    'twitter:card': config.card,
  };

  if (config.title) tags['twitter:title'] = config.title;
  if (config.description) tags['twitter:description'] = config.description;
  if (config.image) tags['twitter:image'] = config.image;
  if (config.imageAlt) tags['twitter:image:alt'] = config.imageAlt;
  if (config.site) tags['twitter:site'] = config.site;
  if (config.creator) tags['twitter:creator'] = config.creator;

  // Player card specific
  if (config.card === 'player') {
    if (config.player) tags['twitter:player'] = config.player;
    if (config.playerWidth) tags['twitter:player:width'] = config.playerWidth;
    if (config.playerHeight) tags['twitter:player:height'] = config.playerHeight;
    if (config.playerStream) tags['twitter:player:stream'] = config.playerStream;
  }

  // App card specific
  if (config.card === 'app') {
    if (config.appName) tags['twitter:app:name:iphone'] = config.appName;
    if (config.appIdIphone) tags['twitter:app:id:iphone'] = config.appIdIphone;
    if (config.appIdIpad) tags['twitter:app:id:ipad'] = config.appIdIpad;
    if (config.appIdGoogleplay) tags['twitter:app:id:googleplay'] = config.appIdGoogleplay;
    if (config.appUrlIphone) tags['twitter:app:url:iphone'] = config.appUrlIphone;
    if (config.appUrlIpad) tags['twitter:app:url:ipad'] = config.appUrlIpad;
    if (config.appUrlGoogleplay) tags['twitter:app:url:googleplay'] = config.appUrlGoogleplay;
  }

  return tags;
}

export function generateCanonicalUrl(path: string, baseUrl: string = DEFAULT_BASE_URL): string {
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

export function generateHreflangTags(config: HreflangConfig): HreflangTag[] {
  const tags: HreflangTag[] = [];
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  // Add tags for each language
  config.languages.forEach(lang => {
    tags.push({
      hreflang: lang.lang,
      href: generateCanonicalUrl(lang.url, baseUrl),
    });
  });

  // Add x-default tag if default language is specified
  if (config.defaultLang) {
    const defaultLangConfig = config.languages.find(l => l.lang === config.defaultLang);
    if (defaultLangConfig) {
      tags.push({
        hreflang: 'x-default',
        href: generateCanonicalUrl(defaultLangConfig.url, baseUrl),
      });
    }
  }

  return tags;
}

// Helper function to generate all meta tags for a page
export function generatePageMetaTags(params: {
  title: string;
  description?: string;
  keywords?: string[];
  url: string;
  image?: string;
  author?: string;
  type?: OpenGraphConfig['type'];
  twitterCard?: TwitterConfig['card'];
  twitterSite?: string;
  twitterCreator?: string;
  languages?: HreflangConfig['languages'];
  defaultLang?: string;
  baseUrl?: string;
}) {
  const canonicalUrl = generateCanonicalUrl(params.url, params.baseUrl);

  const metaTags = generateMetaTags({
    title: params.title,
    description: params.description,
    keywords: params.keywords,
    author: params.author,
    robots: 'index,follow',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
  });

  const openGraphTags = generateOpenGraphTags({
    title: params.title,
    description: params.description,
    url: canonicalUrl,
    image: params.image,
    type: params.type || 'website',
    siteName: 'MindScript',
    locale: 'en_US',
  });

  const twitterTags = generateTwitterTags({
    card: params.twitterCard || 'summary_large_image',
    title: params.title,
    description: params.description,
    image: params.image,
    site: params.twitterSite,
    creator: params.twitterCreator,
  });

  const hreflangTags = params.languages
    ? generateHreflangTags({
        url: params.url,
        languages: params.languages,
        defaultLang: params.defaultLang,
        baseUrl: params.baseUrl,
      })
    : [];

  return {
    metaTags,
    openGraphTags,
    twitterTags,
    hreflangTags,
    canonicalUrl,
  };
}
export const BLOG_CATEGORIES = [
  'subconscious-brain-training',
  'sound-science',
  'affirmations-self-talk',
  'manifestation',
  'performance-focus',
  'techniques-methods',
  'how-to-guides',
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<BlogCategory, string> = {
  'subconscious-brain-training': 'Subconscious & Brain Training',
  'sound-science': 'Sound Science',
  'affirmations-self-talk': 'Affirmations & Self-Talk',
  'manifestation': 'Manifestation',
  'performance-focus': 'Performance & Focus',
  'techniques-methods': 'Techniques & Methods',
  'how-to-guides': 'How-To Guides',
};

export interface BlogPostAuthor {
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface BlogPostSeo {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  focusKeyphrase: string;
}

export interface BlogPostFaqItem {
  question: string;
  answer: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  readTimeMinutes: number;
  coverImage?: string;
  coverImageAlt?: string;
  author: BlogPostAuthor;
  relatedLandingPage?: string;
  relatedSlugs?: string[];
  featured?: boolean;
  seo: BlogPostSeo;
  faq?: BlogPostFaqItem[];
}

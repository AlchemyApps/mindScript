import { blogPosts } from './registry';
import { BLOG_CATEGORIES, CATEGORY_LABELS, type BlogCategory, type BlogPostMeta } from './types';

export function getAllPublishedPosts(): BlogPostMeta[] {
  const now = new Date();
  return blogPosts.filter((post) => new Date(post.publishedAt) <= now);
}

export function getPostBySlug(slug: string): BlogPostMeta | undefined {
  return getAllPublishedPosts().find((post) => post.slug === slug);
}

export function getPostsByCategory(category: BlogCategory): BlogPostMeta[] {
  return getAllPublishedPosts().filter((post) => post.category === category);
}

export function getFeaturedPost(): BlogPostMeta | undefined {
  const posts = getAllPublishedPosts();
  return posts.find((post) => post.featured) ?? posts[0];
}

export function getRelatedPosts(slug: string, limit = 3): BlogPostMeta[] {
  const post = getPostBySlug(slug);
  if (!post) return [];

  const posts = getAllPublishedPosts().filter((p) => p.slug !== slug);

  // Prefer explicit related slugs
  if (post.relatedSlugs?.length) {
    const explicit = post.relatedSlugs
      .map((s) => posts.find((p) => p.slug === s))
      .filter((p): p is BlogPostMeta => p !== undefined);
    if (explicit.length >= limit) return explicit.slice(0, limit);
    // Fill remaining with same-category posts
    const remaining = posts.filter(
      (p) => p.category === post.category && !post.relatedSlugs!.includes(p.slug)
    );
    return [...explicit, ...remaining].slice(0, limit);
  }

  // Fall back to same-category
  return posts.filter((p) => p.category === post.category).slice(0, limit);
}

export function searchPosts(query: string): BlogPostMeta[] {
  const q = query.toLowerCase();
  return getAllPublishedPosts().filter(
    (post) =>
      post.title.toLowerCase().includes(q) ||
      post.excerpt.toLowerCase().includes(q) ||
      post.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export function getAllCategories(): { slug: BlogCategory; label: string }[] {
  const posts = getAllPublishedPosts();
  return BLOG_CATEGORIES.filter((cat) => posts.some((p) => p.category === cat)).map((cat) => ({
    slug: cat,
    label: CATEGORY_LABELS[cat],
  }));
}

export function getAllSlugs(): string[] {
  return getAllPublishedPosts().map((post) => post.slug);
}

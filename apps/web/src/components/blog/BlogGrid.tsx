'use client';

import { useState, useMemo } from 'react';
import { BlogPostCard } from './BlogPostCard';
import { CategoryFilter } from './CategoryFilter';
import { BLOG_CATEGORIES, CATEGORY_LABELS, type BlogCategory, type BlogPostMeta } from '@/lib/blog/types';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface BlogGridProps {
  posts: BlogPostMeta[];
  /** Posts excluded from grid (e.g. featured hero) */
  excludeSlugs?: string[];
  /** Rendered between filters and the card grid (e.g. featured hero) */
  heroSlot?: React.ReactNode;
}

const POSTS_PER_PAGE = 9;

export function BlogGrid({ posts, excludeSlugs = [], heroSlot }: BlogGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const availableCategories = useMemo(() => {
    return BLOG_CATEGORIES
      .filter((cat) => posts.some((p) => p.category === cat))
      .map((cat) => ({ slug: cat, label: CATEGORY_LABELS[cat] }));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let result = posts.filter((p) => !excludeSlugs.includes(p.slug));

    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [posts, excludeSlugs, selectedCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const handleCategoryChange = (cat: BlogCategory | null) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <CategoryFilter
          categories={availableCategories}
          selected={selectedCategory}
          onChange={handleCategoryChange}
        />

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50" />
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm',
              'bg-white/60 backdrop-blur-sm border-2 border-white/30',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10',
              'placeholder:text-muted/50 text-text transition-all'
            )}
          />
        </div>
      </div>

      {/* Hero slot (featured post between filters and grid) */}
      {heroSlot}

      {/* Grid */}
      {paginatedPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedPosts.map((post) => (
            <BlogPostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted text-lg">No articles found</p>
          <p className="text-muted/60 text-sm mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                page === currentPage
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-text hover:bg-white/50'
              )}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Hidden SEO: all posts rendered for crawlers (visually hidden when filtered/paginated) */}
      <div className="sr-only" aria-hidden="true">
        {posts.map((post) => (
          <a key={post.slug} href={`/blog/${post.slug}`}>
            {post.title} - {post.excerpt}
          </a>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { GlassCard } from '@/components/ui/GlassCard';
import { CATEGORY_LABELS, type BlogPostMeta } from '@/lib/blog/types';
import { cn } from '@/lib/utils';

interface BlogPostCardProps {
  post: BlogPostMeta;
  className?: string;
}

export function BlogPostCard({ post, className }: BlogPostCardProps) {
  const dateFormatted = new Date(post.publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/blog/${post.slug}`} className={cn('block group', className)}>
      <GlassCard hover="lift" noPadding className="overflow-hidden h-full flex flex-col">
        {/* Cover image */}
        <div className="relative aspect-video overflow-hidden">
          <Image
            src={post.coverImage || '/images/blog/default-cover.png'}
            alt={post.coverImageAlt || post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {/* Category badge */}
          <span className="absolute top-3 left-3 px-3 py-1 text-xs font-medium rounded-full bg-primary/90 text-white backdrop-blur-sm">
            {CATEGORY_LABELS[post.category]}
          </span>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-heading font-semibold text-text text-lg leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-sm text-muted line-clamp-3 mb-4 flex-1">
            {post.excerpt}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted/70">
            <span>{post.author.name}</span>
            <div className="flex items-center gap-2">
              <span>{dateFormatted}</span>
              <span>&middot;</span>
              <span>{post.readTimeMinutes} min read</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

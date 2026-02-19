'use client';

import Link from 'next/link';
import Image from 'next/image';
import { GlassCard } from '@/components/ui/GlassCard';
import { CATEGORY_LABELS, type BlogPostMeta } from '@/lib/blog/types';

interface BlogHeroProps {
  post: BlogPostMeta;
}

export function BlogHero({ post }: BlogHeroProps) {
  const dateFormatted = new Date(post.publishedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/blog/${post.slug}`} className="block group">
      <GlassCard hover="both" noPadding className="overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-video md:aspect-auto md:min-h-[360px] overflow-hidden">
            <Image
              src={post.coverImage || '/images/blog/default-cover.png'}
              alt={post.coverImageAlt || post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>

          {/* Content */}
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <span className="inline-block self-start px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary mb-4">
              {CATEGORY_LABELS[post.category]}
            </span>

            <h2 className="font-heading font-bold text-text text-2xl md:text-3xl leading-tight mb-3 group-hover:text-primary transition-colors">
              {post.title}
            </h2>

            <p className="text-muted leading-relaxed mb-6 line-clamp-3">
              {post.excerpt}
            </p>

            <div className="flex items-center gap-3 text-sm text-muted/70">
              {post.author.avatarUrl && (
                <Image
                  src={post.author.avatarUrl}
                  alt={post.author.name}
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              )}
              <span className="font-medium text-text">{post.author.name}</span>
              <span>&middot;</span>
              <span>{dateFormatted}</span>
              <span>&middot;</span>
              <span>{post.readTimeMinutes} min read</span>
            </div>

            <span className="inline-flex items-center mt-6 text-primary font-medium text-sm group-hover:gap-2 transition-all">
              Read Article
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

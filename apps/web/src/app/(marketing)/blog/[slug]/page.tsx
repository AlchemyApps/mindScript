import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { generateBlogPostMetadata } from '@/components/SEO/MetaTags';
import { ArticleJsonLd, FAQPageJsonLd, BreadcrumbJsonLd } from '@/components/SEO/JsonLd';
import { BlogContent } from '@/components/blog/BlogContent';
import { BlogFAQ } from '@/components/blog/BlogFAQ';
import { BlogAuthor } from '@/components/blog/BlogAuthor';
import { BlogShareButtons } from '@/components/blog/BlogShareButtons';
import { BlogCTA } from '@/components/blog/BlogCTA';
import { BlogRelatedPosts } from '@/components/blog/BlogRelatedPosts';
import { getPostBySlug, getRelatedPosts, getAllSlugs } from '@/lib/blog/utils';
import { CATEGORY_LABELS } from '@/lib/blog/types';

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  return generateBlogPostMetadata({
    title: post.seo.metaTitle || post.title,
    description: post.seo.metaDescription || post.excerpt,
    keywords: post.seo.keywords,
    slug: post.slug,
    category: CATEGORY_LABELS[post.category],
    author: post.author.name,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    tags: post.tags,
    coverImage: post.coverImage,
  });
}

export default function BlogPostPage({ params }: PageProps) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const relatedPosts = getRelatedPosts(params.slug, 3);
  const categoryLabel = CATEGORY_LABELS[post.category];

  const dateFormatted = new Date(post.publishedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Dynamically import the blog post content component
  const PostContent = dynamic(
    () => import(`@/content/blog/${params.slug}`).catch(() => {
      return { default: () => <p className="text-muted">Content coming soon.</p> };
    }),
    { loading: () => <div className="h-48 animate-pulse bg-white/30 rounded-xl" /> }
  );

  return (
    <>
      {/* JSON-LD */}
      <ArticleJsonLd
        headline={post.title}
        description={post.excerpt}
        image={post.coverImage}
        datePublished={post.publishedAt}
        dateModified={post.updatedAt}
        author={{ name: post.author.name }}
        articleSection={categoryLabel}
        keywords={post.seo.keywords}
        url={`https://mindscript.studio/blog/${post.slug}`}
      />
      {post.faq && post.faq.length > 0 && <FAQPageJsonLd items={post.faq} />}
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://mindscript.studio' },
          { name: 'Blog', url: 'https://mindscript.studio/blog' },
          { name: categoryLabel, url: `https://mindscript.studio/blog?category=${post.category}` },
          { name: post.title },
        ]}
      />

      <article className="container mx-auto px-4 py-12 md:py-16">
        {/* Breadcrumb */}
        <nav className="max-w-3xl mx-auto mb-8 text-sm text-muted">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li>
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/blog" className="hover:text-primary transition-colors">Blog</Link>
            </li>
            <li>/</li>
            <li className="text-text font-medium truncate max-w-[200px]">{post.title}</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="max-w-3xl mx-auto mb-8">
          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary mb-4">
            {categoryLabel}
          </span>
          <h1 className="font-heading font-bold text-text text-3xl md:text-4xl lg:text-5xl leading-tight mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted">
            {post.author.avatarUrl && (
              <Image
                src={post.author.avatarUrl}
                alt={post.author.name}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="font-medium text-text">{post.author.name}</span>
            <span>&middot;</span>
            <time dateTime={post.publishedAt}>{dateFormatted}</time>
            <span>&middot;</span>
            <span>{post.readTimeMinutes} min read</span>
          </div>
        </header>

        {/* Cover image */}
        {post.coverImage && (
          <div className="max-w-4xl mx-auto mb-10">
            <div className="relative aspect-video rounded-2xl overflow-hidden">
              <Image
                src={post.coverImage}
                alt={post.coverImageAlt || post.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 896px"
                priority
              />
            </div>
          </div>
        )}

        {/* Article body */}
        <BlogContent>
          <PostContent />
        </BlogContent>

        {/* FAQ */}
        {post.faq && post.faq.length > 0 && <BlogFAQ items={post.faq} />}

        {/* Author */}
        <BlogAuthor author={post.author} />

        {/* Share */}
        <BlogShareButtons url={`/blog/${post.slug}`} title={post.title} />

        {/* CTA */}
        <BlogCTA relatedLandingPage={post.relatedLandingPage} />

        {/* Related posts */}
        <BlogRelatedPosts posts={relatedPosts} />
      </article>
    </>
  );
}

import type { Metadata } from 'next';
import { generateMetadata as generatePageMetadata } from '@/components/SEO/MetaTags';
import { JsonLd, BreadcrumbJsonLd } from '@/components/SEO/JsonLd';
import { BlogHero } from '@/components/blog/BlogHero';
import { BlogGrid } from '@/components/blog/BlogGrid';
import { getAllPublishedPosts, getFeaturedPost } from '@/lib/blog/utils';

export function generateMetadata(): Metadata {
  return generatePageMetadata({
    title: 'Blog | MindScript',
    description:
      'Explore the science of subconscious reprogramming, binaural beats, solfeggio frequencies, and affirmation techniques. Evidence-based guides for transforming your mindset.',
    url: '/blog',
    keywords: [
      'subconscious reprogramming',
      'binaural beats',
      'solfeggio frequencies',
      'affirmations',
      'meditation',
      'brain training',
      'mindset',
    ],
  });
}

export default function BlogPage() {
  const posts = getAllPublishedPosts();
  const featured = getFeaturedPost();

  return (
    <>
      {/* JSON-LD */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'MindScript Blog',
          description:
            'Explore the science of subconscious reprogramming, binaural beats, solfeggio frequencies, and affirmation techniques.',
          url: 'https://mindscript.studio/blog',
          publisher: {
            '@type': 'Organization',
            name: 'MindScript',
            logo: {
              '@type': 'ImageObject',
              url: 'https://mindscript.studio/images/logo-original.png',
            },
          },
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://mindscript.studio' },
          { name: 'Blog' },
        ]}
      />

      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary mb-4">
            MindScript Blog
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-5xl bg-gradient-to-r from-primary via-primary-light to-accent bg-clip-text text-transparent mb-4 pb-1">
            Insights for Your Mind
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            The science behind subconscious reprogramming, healing frequencies, and
            affirmation techniques, distilled into actionable guides.
          </p>
        </div>

        {/* Filters, featured hero, and post grid */}
        <BlogGrid
          posts={posts}
          excludeSlugs={featured ? [featured.slug] : []}
          heroSlot={featured ? <BlogHero post={featured} /> : undefined}
        />
      </div>
    </>
  );
}

import { BlogPostCard } from './BlogPostCard';
import type { BlogPostMeta } from '@/lib/blog/types';

interface BlogRelatedPostsProps {
  posts: BlogPostMeta[];
}

export function BlogRelatedPosts({ posts }: BlogRelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto my-16">
      <h2 className="font-heading font-bold text-text text-2xl mb-6">
        Related Articles
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {posts.slice(0, 3).map((post) => (
          <BlogPostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}

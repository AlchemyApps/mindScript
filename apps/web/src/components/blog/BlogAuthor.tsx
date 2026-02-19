import Image from 'next/image';
import type { BlogPostAuthor } from '@/lib/blog/types';

interface BlogAuthorProps {
  author: BlogPostAuthor;
}

export function BlogAuthor({ author }: BlogAuthorProps) {
  const initials = author.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto my-12">
      <div className="glass rounded-2xl p-6 flex items-center gap-4">
        {author.avatarUrl ? (
          <Image
            src={author.avatarUrl}
            alt={author.name}
            width={56}
            height={56}
            className="rounded-full"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
            {initials}
          </div>
        )}
        <div>
          <p className="font-heading font-semibold text-text">{author.name}</p>
          <p className="text-sm text-muted">{author.role}</p>
        </div>
      </div>
    </div>
  );
}

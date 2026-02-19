'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Link2 } from 'lucide-react';

interface BlogShareButtonsProps {
  url: string;
  title: string;
}

export function BlogShareButtons({ url, title }: BlogShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-8 flex items-center gap-3">
      <span className="text-sm text-muted mr-1">Share:</span>

      {/* X/Twitter */}
      <button
        onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, '_blank', 'width=550,height=420')}
        className="p-2 rounded-lg text-muted hover:text-text hover:bg-white/50 transition-colors"
        aria-label="Share on X"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      {/* LinkedIn */}
      <button
        onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank', 'width=550,height=420')}
        className="p-2 rounded-lg text-muted hover:text-text hover:bg-white/50 transition-colors"
        aria-label="Share on LinkedIn"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </button>

      {/* Copy link */}
      <button
        onClick={handleCopy}
        className={cn(
          'p-2 rounded-lg transition-colors',
          copied ? 'text-accent' : 'text-muted hover:text-text hover:bg-white/50'
        )}
        aria-label="Copy link"
      >
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

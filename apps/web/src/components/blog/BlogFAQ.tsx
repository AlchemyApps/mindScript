'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BlogPostFaqItem } from '@/lib/blog/types';

interface BlogFAQProps {
  items: BlogPostFaqItem[];
}

export function BlogFAQ({ items }: BlogFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto my-12">
      <h2 className="font-heading font-bold text-text text-2xl mb-6">
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <GlassCard
            key={i}
            hover="none"
            noPadding
            className="overflow-hidden cursor-pointer"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <div className="flex items-center justify-between p-5">
              <h3 className="font-medium text-text pr-4">{item.question}</h3>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-muted shrink-0 transition-transform duration-200',
                  openIndex === i && 'rotate-180'
                )}
              />
            </div>
            {openIndex === i && (
              <div className="px-5 pb-5 pt-0 text-muted text-sm leading-relaxed border-t border-white/20">
                <div className="pt-4">{item.answer}</div>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

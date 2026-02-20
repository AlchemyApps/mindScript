'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

interface LandingFAQProps {
  items: FAQItem[];
  heading?: string;
}

export function LandingFAQ({ items, heading = 'Frequently Asked Questions' }: LandingFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-3xl">
        <h2 className="font-heading font-bold text-text text-3xl md:text-4xl text-center mb-10">
          {heading}
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
                <h3 className="font-medium text-text pr-4 text-lg">{item.question}</h3>
                <ChevronDown
                  className={cn(
                    'w-5 h-5 text-muted shrink-0 transition-transform duration-200',
                    openIndex === i && 'rotate-180'
                  )}
                />
              </div>
              {openIndex === i && (
                <div className="px-5 pb-5 pt-0 text-muted leading-relaxed border-t border-white/20">
                  <div className="pt-4">{item.answer}</div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

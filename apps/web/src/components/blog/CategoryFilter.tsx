'use client';

import { cn } from '@/lib/utils';
import type { BlogCategory } from '@/lib/blog/types';

interface CategoryFilterProps {
  categories: { slug: BlogCategory; label: string }[];
  selected: BlogCategory | null;
  onChange: (category: BlogCategory | null) => void;
}

export function CategoryFilter({ categories, selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200',
          selected === null
            ? 'bg-primary text-white shadow-sm'
            : 'bg-white/50 backdrop-blur-sm border border-white/30 text-muted hover:bg-white/70 hover:text-text'
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => onChange(cat.slug)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200',
            selected === cat.slug
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white/50 backdrop-blur-sm border border-white/30 text-muted hover:bg-white/70 hover:text-text'
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

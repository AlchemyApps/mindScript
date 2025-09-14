"use client";

import { Button } from "@mindscript/ui";
import type { MarketplaceCategory, CategoryWithCount } from "@mindscript/schemas";

interface CategoryNavProps {
  categories: CategoryWithCount[];
  selectedCategory?: MarketplaceCategory;
  onCategorySelect: (category?: MarketplaceCategory) => void;
}

export function CategoryNav({ 
  categories, 
  selectedCategory, 
  onCategorySelect 
}: CategoryNavProps) {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex gap-2 py-4 overflow-x-auto scrollbar-hide">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => onCategorySelect(undefined)}
            className="flex-shrink-0"
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? "default" : "outline"}
              size="sm"
              onClick={() => onCategorySelect(
                selectedCategory === category.name ? undefined : category.name
              )}
              className="flex-shrink-0"
            >
              <span className="mr-2">{category.icon}</span>
              {category.label}
              <span className="ml-2 text-xs opacity-60">({category.count})</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
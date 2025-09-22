"use client";

// Using native HTML inputs instead of missing UI components
import { Button } from "@mindscript/ui";
import { formatPrice, formatDuration } from "@mindscript/schemas";
import type { MarketplaceCategory, CategoryWithCount } from "@mindscript/schemas";

interface FilterPanelProps {
  filters: {
    categories?: MarketplaceCategory[];
    tags?: string[];
    priceRange?: { min?: number; max?: number };
    durationRange?: { min?: number; max?: number };
  };
  onFilterChange: (filters: any) => void;
  onClearFilters: () => void;
  categories: CategoryWithCount[];
}

export function FilterPanel({
  filters,
  onFilterChange,
  onClearFilters,
  categories,
}: FilterPanelProps) {
  const handlePriceChange = (values: number[]) => {
    onFilterChange({
      priceRange: {
        min: values[0],
        max: values[1],
      },
    });
  };

  const handleDurationChange = (values: number[]) => {
    onFilterChange({
      durationRange: {
        min: values[0],
        max: values[1],
      },
    });
  };

  const handleCategoryToggle = (category: MarketplaceCategory) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter((c) => c !== category)
      : [...currentCategories, category];
    
    onFilterChange({
      categories: newCategories.length > 0 ? newCategories : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Filters</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="w-full"
        >
          Clear all filters
        </Button>
      </div>

      {/* Categories */}
      <div>
        <h4 className="font-medium mb-3">Categories</h4>
        <div className="space-y-2">
          {categories.map((category) => (
            <label
              key={category.name}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.categories?.includes(category.name) || false}
                onChange={() => handleCategoryToggle(category.name)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm flex-1">{category.label}</span>
              <span className="text-xs text-muted-foreground">
                ({category.count})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="font-medium mb-3">Price Range</h4>
        <div className="px-2">
          <div className="space-y-2 mb-2">
            <div>
              <label className="text-xs text-muted-foreground">Min Price</label>
              <input
                type="range"
                min={0}
                max={5000}
                step={100}
                value={filters.priceRange?.min || 0}
                onChange={(e) => handlePriceChange([parseInt(e.target.value), filters.priceRange?.max || 5000])}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max Price</label>
              <input
                type="range"
                min={0}
                max={5000}
                step={100}
                value={filters.priceRange?.max || 5000}
                onChange={(e) => handlePriceChange([filters.priceRange?.min || 0, parseInt(e.target.value)])}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatPrice(filters.priceRange?.min || 0)}</span>
            <span>{formatPrice(filters.priceRange?.max || 5000)}</span>
          </div>
        </div>
      </div>

      {/* Duration */}
      <div>
        <h4 className="font-medium mb-3">Duration</h4>
        <div className="px-2">
          <div className="space-y-2 mb-2">
            <div>
              <label className="text-xs text-muted-foreground">Min Duration</label>
              <input
                type="range"
                min={0}
                max={900}
                step={60}
                value={filters.durationRange?.min || 0}
                onChange={(e) => handleDurationChange([parseInt(e.target.value), filters.durationRange?.max || 900])}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max Duration</label>
              <input
                type="range"
                min={0}
                max={900}
                step={60}
                value={filters.durationRange?.max || 900}
                onChange={(e) => handleDurationChange([filters.durationRange?.min || 0, parseInt(e.target.value)])}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDuration(filters.durationRange?.min || 0)}</span>
            <span>{formatDuration(filters.durationRange?.max || 900)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
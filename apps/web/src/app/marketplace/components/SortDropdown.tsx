"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mindscript/ui";
import type { MarketplaceSort } from "@mindscript/schemas";

interface SortDropdownProps {
  value: MarketplaceSort;
  onChange: (value: MarketplaceSort) => void;
}

const sortOptions: { value: MarketplaceSort; label: string }[] = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest First" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "rating", label: "Best Rated" },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]" aria-label="Sort by">
        <SelectValue placeholder="Sort by..." />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
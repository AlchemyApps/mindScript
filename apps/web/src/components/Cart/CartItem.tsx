"use client";

import { X } from "lucide-react";
import { Button } from "@mindscript/ui";
import { useCartStore } from "@/store/cartStore";
import type { CartItem as CartItemType } from "@mindscript/schemas";
import Image from "next/image";

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const removeItem = useCartStore((state) => state.removeItem);
  
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };
  
  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      {/* Track Image */}
      <div className="relative w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
        )}
      </div>
      
      {/* Track Details */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{item.title}</h4>
        <p className="text-sm text-muted-foreground truncate">
          by {item.artistName}
        </p>
        <p className="text-sm font-medium mt-1">
          {formatPrice(item.price)}
        </p>
      </div>
      
      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeItem(item.trackId)}
        className="flex-shrink-0 h-8 w-8"
        aria-label={`Remove ${item.title} from cart`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@mindscript/ui";
import Link from "next/link";

interface EmptyCartProps {
  onClose?: () => void;
}

export function EmptyCart({ onClose }: EmptyCartProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <ShoppingCart className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-medium mb-2">Your cart is empty</h3>
      
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Discover amazing mindfulness tracks created by our community of artists.
      </p>
      
      <Button asChild>
        <Link href="/marketplace" onClick={onClose}>
          Browse Marketplace
        </Link>
      </Button>
    </div>
  );
}
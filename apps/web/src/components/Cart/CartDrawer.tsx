"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@mindscript/ui";
import { useCartStore } from "@/store/cartStore";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";
import { EmptyCart } from "./EmptyCart";
import { cn } from "@/lib/utils";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, error, isSyncing, syncWithServer } = useCartStore();
  const [mounted, setMounted] = useState(false);
  
  // Handle mounting to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Sync cart when drawer opens
  useEffect(() => {
    if (isOpen && mounted) {
      syncWithServer();
    }
  }, [isOpen, mounted, syncWithServer]);
  
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);
  
  if (!mounted) {
    return null;
  }
  
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full sm:w-96 bg-background shadow-xl z-50",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Shopping Cart</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <EmptyCart onClose={onClose} />
            ) : (
              <div className="p-4">
                {isSyncing && (
                  <div className="text-sm text-muted-foreground mb-2">
                    Syncing cart...
                  </div>
                )}
                <div className="space-y-1">
                  {items.map((item) => (
                    <CartItem key={item.trackId} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Summary & Checkout */}
          {items.length > 0 && (
            <div className="p-4 border-t mt-auto">
              <CartSummary />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
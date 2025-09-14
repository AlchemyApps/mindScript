"use client";

import { useCartStore } from "@/store/cartStore";
import { Button } from "@mindscript/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function CartSummary() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { items, getTotal, validateCart } = useCartStore();
  
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };
  
  const handleCheckout = async () => {
    setIsLoading(true);
    
    try {
      // Validate cart first
      const isValid = await validateCart();
      
      if (!isValid) {
        // Cart has invalid items, they've been removed
        // TODO: Show toast notification
        setIsLoading(false);
        return;
      }
      
      // Create checkout session
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map(item => ({
            trackId: item.trackId,
            sellerId: item.sellerId,
            title: item.title,
            price: item.price,
            sellerConnectAccountId: item.sellerConnectAccountId,
          })),
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }
      
      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
      // TODO: Show error toast
      setIsLoading(false);
    }
  };
  
  const subtotal = getTotal();
  const processingFee = Math.floor(subtotal * 0.029 + 30); // 2.9% + 30¢
  const total = subtotal;
  
  if (items.length === 0) {
    return null;
  }
  
  return (
    <div className="border-t pt-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Processing Fee</span>
        <span>Calculated at checkout</span>
      </div>
      
      <div className="flex justify-between font-medium pt-2 border-t">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>
      
      <Button
        className="w-full mt-4"
        onClick={handleCheckout}
        disabled={isLoading || items.length === 0}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Checkout (${items.length} ${items.length === 1 ? "item" : "items"})`
        )}
      </Button>
      
      <p className="text-xs text-center text-muted-foreground mt-2">
        Secure checkout powered by Stripe
      </p>
    </div>
  );
}
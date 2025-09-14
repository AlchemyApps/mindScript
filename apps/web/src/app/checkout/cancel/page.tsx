"use client";

import Link from "next/link";
import { Button, Card } from "@mindscript/ui";
import { XCircle, ShoppingCart, ArrowLeft } from "lucide-react";

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card className="p-8">
          <div className="text-center">
            {/* Cancel Icon */}
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
            
            {/* Description */}
            <p className="text-gray-600 mb-6">
              Your payment was cancelled and no charges were made. Your items are still in your cart.
            </p>

            {/* Actions */}
            <div className="space-y-3">
              <Link href="/cart">
                <Button className="w-full">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Return to Cart
                </Button>
              </Link>
              
              <Link href="/marketplace">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Continue Shopping
                </Button>
              </Link>
            </div>

            {/* Help Text */}
            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-gray-500 mb-3">
                Having trouble with your payment?
              </p>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  • Check that your card details are correct
                </p>
                <p className="text-gray-600">
                  • Ensure you have sufficient funds
                </p>
                <p className="text-gray-600">
                  • Try a different payment method
                </p>
              </div>
              <Link
                href="/support"
                className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Contact Support →
              </Link>
            </div>
          </div>
        </Card>

        {/* Session Expiry Notice */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Your cart items have been saved and will be available for 24 hours. 
            Prices and availability may change.
          </p>
        </div>
      </div>
    </div>
  );
}
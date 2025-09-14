"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Spinner } from "@mindscript/ui";
import { CheckCircle, Download, Music } from "lucide-react";

interface PurchaseDetails {
  items: Array<{
    trackId: string;
    title: string;
    downloadUrl?: string;
  }>;
  totalAmount: number;
  currency: string;
  receiptUrl?: string;
}

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      setLoading(false);
      return;
    }

    // Fetch purchase details
    fetchPurchaseDetails(sessionId);
  }, [sessionId]);

  const fetchPurchaseDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/checkout/success?session_id=${sessionId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch purchase details");
      }

      const data = await response.json();
      setPurchase(data);
    } catch (err) {
      console.error("Error fetching purchase details:", err);
      setError("Failed to load purchase details. Please check your email for confirmation.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner className="w-12 h-12 mx-auto mb-4" />
          <p className="text-gray-600">Loading your purchase details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <Link href="/library">
                <Button className="w-full">Go to Library</Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" className="w-full">
                  Browse More Tracks
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Purchase Successful!</h1>
          <p className="text-gray-600">
            Thank you for your purchase. Your tracks are now available in your library.
          </p>
        </div>

        {/* Purchase Details */}
        {purchase && (
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            
            {/* Purchased Items */}
            <div className="space-y-4 mb-6">
              {purchase.items.map((item, index) => (
                <div
                  key={item.trackId}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Music className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-sm text-gray-500">Ready to download</p>
                    </div>
                  </div>
                  {item.downloadUrl && (
                    <a
                      href={item.downloadUrl}
                      download
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Download</span>
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-lg font-semibold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: purchase.currency,
                  }).format(purchase.totalAmount / 100)}
                </span>
              </div>
            </div>

            {/* Receipt Link */}
            {purchase.receiptUrl && (
              <div className="mt-4 pt-4 border-t">
                <a
                  href={purchase.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View Receipt →
                </a>
              </div>
            )}
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/library">
            <Button className="w-full">
              <Music className="w-4 h-4 mr-2" />
              Go to Library
            </Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="outline" className="w-full">
              Browse More Tracks
            </Button>
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            A confirmation email has been sent to your registered email address.
          </p>
          <p className="mt-2">
            Need help?{" "}
            <Link href="/support" className="text-blue-600 hover:text-blue-700">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@mindscript/ui";
import { CheckCircle, Music, Loader2 } from "lucide-react";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("cs"); // Checkout session ID from Stripe
  const [loading, setLoading] = useState(true);
  const [trackCreationStatus, setTrackCreationStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Trigger track creation immediately (works in both dev and production)
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    // Call local trigger endpoint to ensure track creation
    // This is idempotent - if webhook already processed it, this will just return success
    setTrackCreationStatus('processing');

    fetch('/api/webhooks/stripe/local-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('[SUCCESS-PAGE] Track creation initiated:', data);
          setTrackCreationStatus('success');

          // Redirect to library after 2 seconds
          setTimeout(() => {
            window.location.href = `/library?new=true&session=${sessionId}`;
          }, 2000);
        } else {
          console.error('[SUCCESS-PAGE] Track creation failed:', data);
          setTrackCreationStatus('error');
          setError(data.error || 'Failed to create track');
        }
      })
      .catch(err => {
        console.error('[SUCCESS-PAGE] Error calling local trigger:', err);
        setTrackCreationStatus('error');
        setError(err.message || 'Network error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-indigo-600" />
          <h2 className="text-xl font-semibold mb-2">Processing Your Payment...</h2>
          <p className="text-gray-600">Please wait while we confirm your purchase.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Payment Successful!
          </h1>
          <p className="text-gray-600 mb-6">
            Thank you for your purchase. Your custom audio track is being created and will be ready in 2-5 minutes.
          </p>

          {/* Error Message (if track creation failed) */}
          {trackCreationStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">
                <strong>Track Creation Error:</strong> {error || 'An error occurred while creating your track.'}
              </p>
              <p className="text-xs text-red-600 mt-2">
                Your payment was successful, but we couldn't start building your track. Please contact support.
              </p>
            </div>
          )}

          {/* What Happens Next */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Your track is being rendered with your selected voice and audio layers</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>You'll receive an email when your track is ready</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>You can download and listen to your track from your library</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link href="/library" className="block">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                <Music className="h-4 w-4 mr-2" />
                Go to My Library
              </Button>
            </Link>
            <Link href="/builder" className="block">
              <Button variant="outline" className="w-full">
                Create Another Track
              </Button>
            </Link>
          </div>

          {/* Order Reference */}
          {sessionId && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Order reference: {sessionId.slice(0, 20)}...
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Optional: Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[max(50%,25rem)] top-1/2 -translate-y-1/2 w-[128rem] h-[128rem] rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 opacity-20 blur-3xl" />
      </div>
    </div>
  );
}
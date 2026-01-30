"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@mindscript/ui";
import { CheckCircle, Music, Loader2 } from "lucide-react";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || searchParams.get("cs"); // Stripe sends session_id
  const [loading, setLoading] = useState(true);
  const [pollStatus, setPollStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Trigger track creation immediately (works in both dev and production)
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    // Call local trigger endpoint to ensure track creation
    // This is idempotent - if webhook already processed it, this will just return success
    setPollStatus('processing');

    fetch('/api/webhooks/stripe/local-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          console.error('[SUCCESS-PAGE] Track creation failed:', data);
          setPollStatus('error');
          setError(data.error || 'Failed to create track');
          return;
        }
        console.log('[SUCCESS-PAGE] Track creation initiated:', data);
        setPollStatus('processing');
        pollForTrackCompletion();
      })
      .catch(err => {
        console.error('[SUCCESS-PAGE] Error calling local trigger:', err);
        setPollStatus('error');
        setError(err.message || 'Network error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const pollForTrackCompletion = () => {
    if (!sessionId) return;

    let pollCount = 0;
    const maxPolls = 60; // ~5 minutes

    const poll = async () => {
      try {
        const response = await fetch('/api/library/tracks?status=all&ownership=owned&includeRenderStatus=true');
        if (!response.ok) {
          throw new Error('Failed to fetch tracks');
        }
        const data = await response.json();
        const track = (data.tracks || []).find((t: any) => t.renderStatus && t.renderStatus.id);

        if (track && (track.audio_url || track.status === 'published')) {
          setPollStatus('success');
          setTimeout(() => {
            window.location.href = `/library?new=true&session=${sessionId}`;
          }, 1500);
          return;
        }

        pollCount += 1;
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000);
        } else {
          setPollStatus('error');
          setError('Track is taking longer than expected. Check your library in a few minutes.');
        }
      } catch (err) {
        console.error('[SUCCESS-PAGE] Polling error:', err);
        pollCount += 1;
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000);
        } else {
          setPollStatus('error');
          setError('Track is taking longer than expected. Visit your library in a few minutes.');
        }
      }
    };

    poll();
  };

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
          {pollStatus === 'success' ? (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Your track is ready!
              </h1>
              <p className="text-gray-600">
                Redirecting you to the library...
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
                  <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Payment Successful!
              </h1>
              <p className="text-gray-600 mb-6">
                Your custom audio track is being rendered. This usually takes 2-5 minutes. We'll redirect you once it's ready.
              </p>

              {pollStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-800">
                    <strong>Render Delay:</strong> {error || 'Your track is taking longer than expected.'}
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    We’ll keep building it in the background. You can check your library manually if the redirect doesn’t happen.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>We’re rendering each layer (voice, music, tones) with your settings</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>We’ll email you when the track is ready</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>You can monitor progress from your library</span>
                  </li>
                </ul>
              </div>

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

              {sessionId && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Order reference: {sessionId.slice(0, 20)}...
                  </p>
                </div>
              )}
            </>
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

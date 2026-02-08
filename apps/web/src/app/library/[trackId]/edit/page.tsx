'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { TrackEditor, type EditPayload } from '../../../../components/library/TrackEditor';
import { CoverArtUploader } from '../../../../components/library/CoverArtUploader';
import { usePlayerStore } from '../../../../store/playerStore';
import { cn } from '../../../../lib/utils';

interface TrackData {
  id: string;
  title: string;
  voice_config: any;
  music_config: any;
  frequency_config: any;
  output_config: any;
  edit_count: number;
  start_delay_seconds: number;
  cover_image_url: string | null;
}

interface EligibilityData {
  canEdit: boolean;
  editCount: number;
  freeEditsRemaining: number;
  baseFee: number;
  totalFee: number;
  reason?: string;
}

export default function TrackEditPage() {
  const params = useParams();
  const router = useRouter();
  const trackId = params.trackId as string;

  const { currentTrack: playerTrack } = usePlayerStore();
  const [track, setTrack] = useState<TrackData | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch track data and eligibility
  useEffect(() => {
    async function loadData() {
      try {
        // Get user session
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }
        setUserId(user.id);

        // Fetch track
        const { data: trackData, error: trackError } = await supabase
          .from('tracks')
          .select('id, title, voice_config, music_config, frequency_config, output_config, edit_count, start_delay_seconds, cover_image_url, user_id')
          .eq('id', trackId)
          .single();

        if (trackError || !trackData) {
          setError('Track not found');
          return;
        }

        if (trackData.user_id !== user.id) {
          setError('You do not own this track');
          return;
        }

        setTrack(trackData);

        // Fetch edit eligibility
        const eligibilityRes = await fetch(`/api/tracks/${trackId}/edit-eligibility`, {
          headers: { 'x-user-id': user.id },
        });

        if (!eligibilityRes.ok) {
          setError('Failed to check edit eligibility');
          return;
        }

        const eligibilityData = await eligibilityRes.json();
        setEligibility(eligibilityData);
      } catch (err) {
        setError('Failed to load track data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [trackId, router]);

  const handleSubmit = async (editData: EditPayload) => {
    if (!userId || !eligibility) return;

    // If payment required, redirect to checkout
    if (eligibility.totalFee > 0) {
      const response = await fetch('/api/checkout/track-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          userId,
          editData,
          totalFeeCents: eligibility.totalFee,
          successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=edit`,
          cancelUrl: `${window.location.origin}/library/${trackId}/edit`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
      return;
    }

    // Free edit — submit directly
    const response = await fetch(`/api/tracks/${trackId}/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(editData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to submit edit');
    }

    // Redirect to library with success
    router.push('/library?edited=true');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted">Loading track...</p>
        </div>
      </div>
    );
  }

  if (error || !track || !eligibility) {
    return (
      <div className="min-h-screen bg-warm-gradient flex items-center justify-center">
        <div className="glass rounded-2xl p-8 max-w-md text-center space-y-4">
          <p className="text-text font-medium">{error || 'Something went wrong'}</p>
          <button
            onClick={() => router.push('/library')}
            className="text-primary text-sm hover:underline"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  if (!eligibility.canEdit) {
    return (
      <div className="min-h-screen bg-warm-gradient flex items-center justify-center">
        <div className="glass rounded-2xl p-8 max-w-md text-center space-y-4">
          <p className="text-text font-medium">{eligibility.reason || 'This track cannot be edited'}</p>
          <button
            onClick={() => router.push('/library')}
            className="text-primary text-sm hover:underline"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-warm-gradient", playerTrack && "pb-28")}>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted hover:text-text transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </button>

        {/* Cover art */}
        <div className="glass rounded-2xl p-6 mb-4">
          <CoverArtUploader
            trackId={trackId}
            currentUrl={track.cover_image_url}
          />
        </div>

        {/* Editor card */}
        <div className="glass rounded-2xl p-6">
          <TrackEditor
            trackId={trackId}
            trackTitle={track.title}
            config={{
              voiceConfig: track.voice_config,
              musicConfig: track.music_config,
              frequencyConfig: track.frequency_config,
              outputConfig: track.output_config,
            }}
            startDelaySec={track.start_delay_seconds ?? 3}
            eligibility={eligibility}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}

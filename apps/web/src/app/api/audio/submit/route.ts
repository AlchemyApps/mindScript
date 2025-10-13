import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { AudioJobSchema } from '@mindscript/schemas';

// Input schema from the builder form
const submitSchema = z.object({
  script: z.string().min(10).max(5000),
  voice: z.object({
    provider: z.enum(['openai', 'elevenlabs', 'uploaded']),
    voice_id: z.string().min(1),
    settings: z.object({
      speed: z.number().min(0.25).max(4.0).optional(),
      pitch: z.number().min(-2).max(2).optional(),
    }).optional(),
  }),
  music: z.object({
    id: z.string().optional(),
    volume_db: z.number().min(-20).max(0),
  }).optional(),
  solfeggio: z.object({
    enabled: z.boolean(),
    frequency: z.number().optional(),
    volume_db: z.number().min(-30).max(0),
  }).optional(),
  binaural: z.object({
    enabled: z.boolean(),
    band: z.enum(['delta', 'theta', 'alpha', 'beta', 'gamma']).optional(),
    volume_db: z.number().min(-30).max(0),
  }).optional(),
  title: z.string().min(1).max(255).optional(),
  duration: z.number().min(5).max(15).default(10),
});

type SubmitData = z.infer<typeof submitSchema>;

// Helper to map binaural band to beat frequencies
const binauralBandToFrequency = (band: string) => {
  const frequencies = {
    delta: { beatHz: 2, carrierHz: 200 },
    theta: { beatHz: 6, carrierHz: 210 },
    alpha: { beatHz: 10, carrierHz: 220 },
    beta: { beatHz: 20, carrierHz: 230 },
    gamma: { beatHz: 40, carrierHz: 240 },
  };
  return frequencies[band as keyof typeof frequencies] || frequencies.alpha;
};

/**
 * DEPRECATED: This endpoint has been replaced with the Stripe checkout flow.
 *
 * All track creation now requires payment and happens via the webhook after
 * successful checkout. This prevents free track creation and ensures proper
 * payment processing.
 *
 * Flow:
 * 1. User fills out builder form
 * 2. Submits to /api/checkout/guest-conversion
 * 3. Completes Stripe payment
 * 4. Webhook creates track via startTrackBuild()
 *
 * This endpoint returns 410 Gone to indicate it's permanently deprecated.
 */
export async function POST(request: NextRequest) {
  console.error('[SECURITY] Attempted to call deprecated /api/audio/submit endpoint directly');

  return NextResponse.json(
    {
      error: 'Endpoint deprecated',
      message: 'Direct track creation is no longer supported. All tracks must be created through the payment checkout flow at /api/checkout/guest-conversion',
      redirect: '/builder'
    },
    { status: 410 } // 410 Gone - resource permanently removed
  );
}
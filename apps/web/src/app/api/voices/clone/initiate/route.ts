/**
 * Voice Clone Initiation API
 * Uploads audio sample, stores consent, creates $29 Stripe checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { CUSTOM_VOICE_CREATION_FEE_CENTS } from '@mindscript/schemas';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getSupabaseClient(request: NextRequest) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: request.headers.get('Authorization') || '' },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient(request);

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has an active cloned voice
    const { data: existingVoices } = await supabaseAdmin
      .from('cloned_voices')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'processing'])
      .is('deleted_at', null);

    if (existingVoices && existingVoices.length > 0) {
      return NextResponse.json(
        { error: 'You already have an active custom voice. Delete it first to create a new one.' },
        { status: 409 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const voiceName = formData.get('name') as string;
    const consentJson = formData.get('consent') as string;

    if (!audioFile || !voiceName || !consentJson) {
      return NextResponse.json(
        { error: 'Missing required fields: audio, name, consent' },
        { status: 400 }
      );
    }

    // Validate consent
    let consent;
    try {
      consent = JSON.parse(consentJson);
      const requiredFields = ['hasConsent', 'isOver18', 'acceptsTerms', 'ownsVoice', 'understandsUsage', 'noImpersonation'];
      for (const field of requiredFields) {
        if (consent[field] !== true) {
          return NextResponse.json(
            { error: `Missing consent: ${field}` },
            { status: 400 }
          );
        }
      }
    } catch {
      return NextResponse.json({ error: 'Invalid consent data' }, { status: 400 });
    }

    // Validate audio
    if (audioFile.size < 100000) {
      return NextResponse.json({ error: 'Audio file too small (min 100KB)' }, { status: 400 });
    }
    if (audioFile.size > 10485760) {
      return NextResponse.json({ error: 'Audio file too large (max 10MB)' }, { status: 400 });
    }

    // Upload audio to Supabase storage
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const fileName = `${user.id}/${Date.now()}-voice-sample.${audioFile.name.split('.').pop() || 'wav'}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('voice-samples')
      .upload(fileName, audioBuffer, {
        contentType: audioFile.type || 'audio/wav',
        upsert: false,
      });

    if (uploadError) {
      console.error('[VOICE-CLONE] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload audio sample' }, { status: 500 });
    }

    // Get signed URL
    const { data: urlData } = await supabaseAdmin.storage
      .from('voice-samples')
      .createSignedUrl(fileName, 86400); // 24 hours for processing

    // Look up existing Stripe customer for fast checkout
    let stripeCustomerId: string | undefined;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();
    stripeCustomerId = profile?.stripe_customer_id ?? undefined;

    const customerParams: Partial<Stripe.Checkout.SessionCreateParams> = stripeCustomerId
      ? { customer: stripeCustomerId }
      : { customer_creation: 'always' as const };

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: CUSTOM_VOICE_CREATION_FEE_CENTS,
            product_data: {
              name: 'Custom Voice Setup',
              description: 'One-time voice cloning fee — create your unique AI voice',
              metadata: { type: 'voice_clone' },
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL}/builder?voice_clone=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL}/builder?voice_clone=cancelled`,
      metadata: {
        type: 'voice_clone',
        user_id: user.id,
        voice_name: voiceName,
        sample_file_path: fileName,
        sample_url: urlData?.signedUrl || '',
        consent_data: consentJson,
      },
      ...customerParams,
      payment_method_types: ['card', 'link'],
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url!,
    });
  } catch (error) {
    console.error('[VOICE-CLONE-INITIATE] Error:', error);
    return NextResponse.json({ error: 'Failed to initiate voice cloning' }, { status: 500 });
  }
}

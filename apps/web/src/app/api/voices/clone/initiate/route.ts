/**
 * Voice Clone Initiation API
 * Uploads audio sample, stores consent, creates $29 Stripe checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@mindscript/auth/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { getUserFFTier } from '@/lib/pricing/ff-tier';
import { getPricingConfig } from '@/lib/pricing/pricing-service';

export const maxDuration = 60;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const supabaseAdmin = createServiceRoleClient();

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user via cookies
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
    const rawType = audioFile.type || 'audio/wav';
    // Normalize MIME type — Supabase rejects extended types like "audio/webm;codecs=opus"
    const contentType = rawType.split(';')[0].trim();
    const ext = contentType === 'audio/webm' ? 'webm'
      : contentType === 'audio/mp4' ? 'mp4'
      : contentType === 'audio/ogg' ? 'ogg'
      : audioFile.name.split('.').pop() || 'wav';
    const fileName = `${user.id}/${Date.now()}-voice-sample.${ext}`;

    // Direct REST upload to avoid EPIPE from supabase-js SDK + undici (storage-js#178)
    console.log('[VOICE-CLONE] Upload starting', {
      fileName,
      contentType,
      size: audioBuffer.length,
    });

    const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/voice-samples/${fileName}`;
    let uploadOk = false;
    let lastUploadError: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
          },
          body: audioBuffer,
        });

        if (res.ok) {
          uploadOk = true;
          console.log('[VOICE-CLONE] Upload succeeded on attempt', attempt);
          break;
        }

        lastUploadError = `HTTP ${res.status}: ${await res.text()}`;
        console.warn(`[VOICE-CLONE] Upload attempt ${attempt} failed:`, lastUploadError);
      } catch (err) {
        lastUploadError = (err as Error).message;
        console.warn(`[VOICE-CLONE] Upload attempt ${attempt} error:`, lastUploadError);
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }

    if (!uploadOk) {
      console.error('[VOICE-CLONE] Upload failed after 3 attempts:', lastUploadError);
      return NextResponse.json({ error: 'Failed to upload audio sample' }, { status: 500 });
    }

    // Get signed URL
    const { data: urlData } = await supabaseAdmin.storage
      .from('voice-samples')
      .createSignedUrl(fileName, 86400); // 24 hours for processing

    // Check F&F tier — inner_circle and cost_pass get free voice cloning
    const ffTier = await getUserFFTier(user.id);
    if (ffTier === 'inner_circle' || ffTier === 'cost_pass') {
      // Record $0 purchase
      await supabaseAdmin.from('purchases').insert({
        user_id: user.id,
        checkout_session_id: `ff_voice_clone_${Date.now()}_${user.id.slice(0, 8)}`,
        amount: 0,
        cogs_cents: 0,
        currency: 'usd',
        status: 'completed',
        metadata: {
          type: 'voice_clone',
          ff_tier: ffTier,
          voice_name: voiceName,
          sample_file_path: fileName,
        },
        created_at: new Date().toISOString(),
      });

      // Trigger voice cloning directly (same flow as webhook)
      const audioData = await supabaseAdmin.storage
        .from('voice-samples')
        .download(fileName);

      if (audioData.data) {
        const cloneBuffer = Buffer.from(await audioData.data.arrayBuffer());

        // Create cloned_voices record
        const { data: voiceRecord } = await supabaseAdmin
          .from('cloned_voices')
          .insert({
            user_id: user.id,
            voice_id: 'pending',
            voice_name: voiceName,
            sample_file_url: urlData?.signedUrl || '',
            sample_file_size: cloneBuffer.length,
            status: 'processing',
          })
          .select()
          .single();

        // Store consent record
        if (voiceRecord) {
          try {
            const parsedConsent = JSON.parse(consentJson);
            await supabaseAdmin.from('voice_consent_records').insert({
              voice_id: voiceRecord.id,
              user_id: user.id,
              has_consent: parsedConsent.hasConsent ?? true,
              is_over_18: parsedConsent.isOver18 ?? true,
              accepts_terms: parsedConsent.acceptsTerms ?? true,
              owns_voice: parsedConsent.ownsVoice ?? true,
              understands_usage: parsedConsent.understandsUsage ?? true,
              no_impersonation: parsedConsent.noImpersonation ?? true,
              consent_text: 'User consented to voice cloning terms and conditions v1.0',
              consent_version: '1.0',
            });
          } catch {
            // Non-critical
          }
        }

        // Call ElevenLabs directly
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = { webm: 'audio/webm', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'audio/mp4', ogg: 'audio/ogg' };
        const derivedMimeType = (ext && mimeMap[ext]) || 'audio/webm';

        const form = new FormData();
        form.append('name', voiceName);
        form.append('files', new Blob([cloneBuffer], { type: derivedMimeType }), fileName.split('/').pop() || 'voice-sample.webm');

        let elevenLabsVoiceId: string | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
              method: 'POST',
              headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
              body: form,
            });
            if (res.ok) {
              const body = await res.json();
              elevenLabsVoiceId = body.voice_id;
              break;
            }
          } catch {
            // retry
          }
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
        }

        if (voiceRecord) {
          if (elevenLabsVoiceId) {
            await supabaseAdmin.from('cloned_voices').update({
              voice_id: elevenLabsVoiceId,
              status: 'active',
            }).eq('id', voiceRecord.id);
          } else {
            await supabaseAdmin.from('cloned_voices').update({
              status: 'failed',
              error_message: 'Voice cloning failed after 3 attempts',
            }).eq('id', voiceRecord.id);
          }
        }
      }

      const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
      return NextResponse.json({
        skipStripe: true,
        url: `${origin}/builder?voice_clone=success`,
      });
    }

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

    // Fetch dynamic voice clone fee from admin-controlled pricing
    const pricingConfig = await getPricingConfig();
    const voiceCloneFeeCents = pricingConfig.voiceCloneFeeCents;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: voiceCloneFeeCents,
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
      payment_intent_data: {
        setup_future_usage: 'off_session',
      },
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

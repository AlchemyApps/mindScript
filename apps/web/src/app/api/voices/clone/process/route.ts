/**
 * Voice Clone Processing API
 * Called after payment to trigger ElevenLabs voice cloning
 * Also serves as a status endpoint (GET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

/**
 * GET /api/voices/clone/process?session_id=xxx
 * Check the status of a voice clone operation
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = new URL(request.url).searchParams.get('session_id');

    if (sessionId) {
      // Check by checkout session ID
      const { data: purchase } = await supabaseAdmin
        .from('purchases')
        .select('id, metadata, status')
        .eq('checkout_session_id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (!purchase) {
        return NextResponse.json({ status: 'pending_payment' });
      }

      // Check if voice has been created
      const { data: voice } = await supabaseAdmin
        .from('cloned_voices')
        .select('id, voice_name, status, voice_id')
        .eq('user_id', user.id)
        .in('status', ['processing', 'active'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!voice) {
        return NextResponse.json({ status: 'processing' });
      }

      return NextResponse.json({
        status: voice.status,
        voice: {
          id: voice.id,
          name: voice.voice_name,
          voiceId: voice.voice_id,
        },
      });
    }

    // Return latest voice status
    const { data: voice } = await supabaseAdmin
      .from('cloned_voices')
      .select('id, voice_name, status, voice_id, created_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!voice) {
      return NextResponse.json({ status: 'none' });
    }

    return NextResponse.json({
      status: voice.status,
      voice: {
        id: voice.id,
        name: voice.voice_name,
        voiceId: voice.voice_id,
      },
    });
  } catch (error) {
    console.error('[VOICE-CLONE-STATUS] Error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

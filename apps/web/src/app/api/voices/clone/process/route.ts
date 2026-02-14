/**
 * Voice Clone Processing API
 * Called after payment to trigger ElevenLabs voice cloning
 * Also serves as a status endpoint (GET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@mindscript/auth/server';
import { createClient } from '@/lib/supabase/server';

const supabaseAdmin = createServiceRoleClient();

export const maxDuration = 60;

const VOICE_PREVIEW_TEXT =
  "Welcome to your personalized audio experience. Every word you hear is spoken in your own voice, crafted just for you.";

async function generateVoicePreview(
  elevenLabsVoiceId: string,
  userId: string,
): Promise<string | null> {
  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: VOICE_PREVIEW_TEXT,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!ttsRes.ok) {
      console.warn('[VOICE-CLONE-RETRY] TTS preview generation failed:', ttsRes.status, await ttsRes.text());
      return null;
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    const previewPath = `voice-previews/${userId}/${elevenLabsVoiceId}.mp3`;
    const uploadRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/previews/${previewPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'audio/mpeg',
          'x-upsert': 'true',
        },
        body: audioBuffer,
      },
    );

    if (!uploadRes.ok) {
      console.warn('[VOICE-CLONE-RETRY] Preview upload failed:', uploadRes.status, await uploadRes.text());
      return null;
    }

    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/previews/${previewPath}`;
  } catch (error) {
    console.warn('[VOICE-CLONE-RETRY] Voice preview generation error:', error);
    return null;
  }
}

/**
 * POST /api/voices/clone/process
 * Retry a failed voice clone — re-downloads sample and calls ElevenLabs
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the most recent failed voice clone for this user
    const { data: failedVoice, error: lookupError } = await supabaseAdmin
      .from('cloned_voices')
      .select('id, voice_name, sample_file_url, status')
      .eq('user_id', user.id)
      .eq('status', 'failed')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lookupError || !failedVoice) {
      return NextResponse.json({ error: 'No failed voice clone found to retry' }, { status: 404 });
    }

    // Find the sample file path from storage
    const { data: storageFiles } = await supabaseAdmin.storage
      .from('voice-samples')
      .list(user.id, { limit: 5, sortBy: { column: 'created_at', order: 'desc' } });

    const sampleFile = storageFiles?.[0];
    if (!sampleFile) {
      return NextResponse.json({ error: 'Voice sample not found in storage' }, { status: 404 });
    }

    const sampleFilePath = `${user.id}/${sampleFile.name}`;
    console.log('[VOICE-CLONE-RETRY] Re-processing:', { voiceId: failedVoice.id, sampleFilePath });

    // Mark as processing
    await supabaseAdmin.from('cloned_voices').update({
      status: 'processing',
      error_message: null,
    }).eq('id', failedVoice.id);

    // Download audio
    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('voice-samples')
      .download(sampleFilePath);

    if (downloadError || !audioData) {
      console.error('[VOICE-CLONE-RETRY] Download failed:', downloadError);
      await supabaseAdmin.from('cloned_voices').update({
        status: 'failed',
        error_message: 'Failed to download audio sample on retry',
      }).eq('id', failedVoice.id);
      return NextResponse.json({ error: 'Failed to download audio sample' }, { status: 500 });
    }

    const audioBuffer = Buffer.from(await audioData.arrayBuffer());

    // Derive mimeType from file extension
    const ext = sampleFilePath.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { webm: 'audio/webm', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'audio/mp4', ogg: 'audio/ogg' };
    const mimeType = (ext && mimeMap[ext]) || 'audio/webm';

    // Call ElevenLabs directly (bypass SDK to avoid undici fetch issues)
    const form = new FormData();
    form.append('name', failedVoice.voice_name);
    form.append('files', new Blob([audioBuffer], { type: mimeType }), sampleFile.name);

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
          console.log(`[VOICE-CLONE-RETRY] ElevenLabs succeeded on attempt ${attempt}:`, elevenLabsVoiceId);
          break;
        }

        const errText = await res.text();
        console.error(`[VOICE-CLONE-RETRY] ElevenLabs attempt ${attempt}: HTTP ${res.status}`, errText);
      } catch (fetchErr) {
        console.error(`[VOICE-CLONE-RETRY] ElevenLabs attempt ${attempt} error:`, (fetchErr as Error).message);
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }

    if (!elevenLabsVoiceId) {
      await supabaseAdmin.from('cloned_voices').update({
        status: 'failed',
        error_message: 'Voice cloning failed after 3 attempts',
      }).eq('id', failedVoice.id);
      return NextResponse.json({ error: 'Voice cloning failed after 3 attempts' }, { status: 500 });
    }

    // Success — update record and add to voice catalog
    await supabaseAdmin.from('cloned_voices').update({
      voice_id: elevenLabsVoiceId,
      status: 'active',
      error_message: null,
    }).eq('id', failedVoice.id);

    // Generate TTS preview (non-blocking — voice still works if this fails)
    const previewUrl = await generateVoicePreview(elevenLabsVoiceId, user.id);
    if (previewUrl) {
      console.log('[VOICE-CLONE-RETRY] Voice preview generated:', previewUrl);
    } else {
      console.warn('[VOICE-CLONE-RETRY] Voice preview generation failed, continuing without preview');
    }

    await supabaseAdmin.from('voice_catalog').insert({
      internal_code: `elevenlabs:${elevenLabsVoiceId}`,
      display_name: failedVoice.voice_name,
      description: 'Custom cloned voice',
      gender: null,
      tier: 'custom',
      provider: 'elevenlabs',
      provider_voice_id: elevenLabsVoiceId,
      preview_url: previewUrl,
      is_enabled: true,
      sort_order: 0,
      owner_user_id: user.id,
    });

    console.log('[VOICE-CLONE-RETRY] Success:', elevenLabsVoiceId);
    return NextResponse.json({
      status: 'active',
      voice: {
        id: failedVoice.id,
        name: failedVoice.voice_name,
        voiceId: elevenLabsVoiceId,
      },
    });
  } catch (error) {
    console.error('[VOICE-CLONE-RETRY] Error:', error);
    return NextResponse.json({ error: 'Failed to reprocess voice clone' }, { status: 500 });
  }
}

/**
 * GET /api/voices/clone/process?session_id=xxx
 * Check the status of a voice clone operation
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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

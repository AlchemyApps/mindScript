/**
 * One-time backfill: Generate TTS preview for existing cloned voices
 * that have preview_url = null.
 *
 * Usage: node scripts/backfill-voice-preview.mjs
 * Requires: ELEVENLABS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Loads env from apps/web/.env.local
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../apps/web/.env.local');

// Simple .env parser
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ELEVENLABS_API_KEY) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY');
  process.exit(1);
}

const PREVIEW_TEXT =
  "Welcome to your personalized audio experience. Every word you hear is spoken in your own voice, crafted just for you.";

async function main() {
  // 1. Find custom voices with no preview
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/voice_catalog?tier=eq.custom&preview_url=is.null&select=id,display_name,provider_voice_id,owner_user_id`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );

  if (!listRes.ok) {
    console.error('Failed to query voice_catalog:', await listRes.text());
    process.exit(1);
  }

  const voices = await listRes.json();
  console.log(`Found ${voices.length} custom voice(s) without preview`);

  for (const voice of voices) {
    console.log(`\nProcessing: ${voice.display_name} (${voice.provider_voice_id})`);

    // 2. Generate TTS
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.provider_voice_id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!ttsRes.ok) {
      console.error(`  TTS failed: ${ttsRes.status}`, await ttsRes.text());
      continue;
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    console.log(`  TTS generated: ${audioBuffer.length} bytes`);

    // 3. Upload to previews bucket
    const previewPath = `voice-previews/${voice.owner_user_id}/${voice.provider_voice_id}.mp3`;
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/previews/${previewPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'audio/mpeg',
          'x-upsert': 'true',
        },
        body: audioBuffer,
      },
    );

    if (!uploadRes.ok) {
      console.error(`  Upload failed: ${uploadRes.status}`, await uploadRes.text());
      continue;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${previewPath}`;
    console.log(`  Uploaded: ${publicUrl}`);

    // 4. Update voice_catalog
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/voice_catalog?id=eq.${voice.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ preview_url: publicUrl }),
      },
    );

    if (!updateRes.ok) {
      console.error(`  DB update failed: ${updateRes.status}`, await updateRes.text());
      continue;
    }

    console.log(`  Updated voice_catalog preview_url`);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

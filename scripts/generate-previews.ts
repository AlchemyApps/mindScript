/**
 * Preview Audio Generation Script
 * Generates preview samples for:
 * - Voices (OpenAI + ElevenLabs)
 * - Solfeggio frequencies
 * - Binaural beats
 *
 * Usage:
 *   npx ts-node scripts/generate-previews.ts [--voices] [--solfeggio] [--binaural] [--all]
 *
 * Prerequisites:
 *   - OPENAI_API_KEY in .env
 *   - ELEVENLABS_API_KEY in .env
 *   - ffmpeg installed locally
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/web/.env.local') });

const OUTPUT_DIR = path.join(__dirname, '../apps/web/public/audio-previews');
const PREVIEW_DURATION = 10; // seconds

// ============================================
// Voice Configuration
// ============================================

const PREVIEW_TEXT = `Take a deep breath in. Feel the calm wash over you. You are safe. You are at peace. Let go of any tension, and simply be present in this moment.`;

// Shorter text for ElevenLabs to stay under 100 character quota
const ELEVENLABS_PREVIEW_TEXT = `Take a deep breath. Feel the calm. You are safe. You are at peace.`;

const OPENAI_VOICES = [
  { id: 'alloy', displayName: 'Sage' },
  { id: 'nova', displayName: 'Aurora' },
  { id: 'onyx', displayName: 'Summit' },
  { id: 'shimmer', displayName: 'Breeze' },
  { id: 'echo', displayName: 'Ember' },
  { id: 'fable', displayName: 'River' },
];

const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', displayName: 'Celeste' },    // Rachel
  { id: 'EXAVITQu4vr4xnSDxMaL', displayName: 'Luna' },       // Bella
  { id: 'MF3mGyEYCl7XYWbV9V6O', displayName: 'Willow' },     // Elli
  { id: 'XB0fDUnXU5powFXDhCwa', displayName: 'Harmony' },    // Charlotte
  { id: 'ThT5KcBeYPX3keUQqHPh', displayName: 'Grace' },      // Dorothy
  { id: 'pNInz6obpgDQGcFmaJgB', displayName: 'Atlas' },      // Adam
  { id: 'TxGEqnHWrfWFTfGW9XjX', displayName: 'Orion' },      // Josh
  { id: 'VR6AewLTigWG4xSOukaG', displayName: 'Stone' },      // Arnold
  { id: 'yoZ06aMxZJJ28mfd3POQ', displayName: 'Haven' },      // Sam
  { id: 'ErXwobaYiN019PkySvjV', displayName: 'Zen' },        // Antoni
  { id: 'AZnzlk1XvdvUeBnXmlld', displayName: 'Spirit' },     // Domi
  { id: 'D38z5RcWu1voky8WS1ja', displayName: 'Cloud' },      // Fin
  { id: 'z9fAnlkpzviPz146aGWa', displayName: 'Dawn' },       // Glinda
  { id: 'jsCqWAovK2LkecY7zXl4', displayName: 'Ocean' },      // Freya
];

// ============================================
// Solfeggio Configuration
// ============================================

const SOLFEGGIO_FREQUENCIES = [
  { hz: 174, name: 'Pain Relief', description: 'Foundation frequency for physical healing' },
  { hz: 285, name: 'Tissue Healing', description: 'Promotes cellular regeneration' },
  { hz: 396, name: 'Liberation', description: 'Releases fear and guilt' },
  { hz: 417, name: 'Change', description: 'Facilitates change and transformation' },
  { hz: 528, name: 'Transformation', description: 'DNA repair, miracle tone' },
  { hz: 639, name: 'Connection', description: 'Enhances relationships and communication' },
  { hz: 741, name: 'Expression', description: 'Awakens intuition and self-expression' },
  { hz: 852, name: 'Intuition', description: 'Returns to spiritual order' },
  { hz: 963, name: 'Awakening', description: 'Crown chakra activation' },
];

// ============================================
// Binaural Beats Configuration
// ============================================

const BINAURAL_BANDS = [
  { band: 'delta', beatHz: 2, carrierHz: 100, name: 'Deep Sleep', description: '0.5-4 Hz for deep sleep and healing' },
  { band: 'theta', beatHz: 6, carrierHz: 150, name: 'Meditation', description: '4-8 Hz for deep meditation and creativity' },
  { band: 'alpha', beatHz: 10, carrierHz: 200, name: 'Relaxation', description: '8-13 Hz for calm focus and relaxation' },
  { band: 'beta', beatHz: 20, carrierHz: 250, name: 'Focus', description: '13-30 Hz for alertness and concentration' },
  { band: 'gamma', beatHz: 40, carrierHz: 300, name: 'Peak Performance', description: '30-100 Hz for peak mental activity' },
];

// ============================================
// Utility Functions
// ============================================

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Voice Preview Generation
// ============================================

async function generateOpenAIVoicePreviews() {
  const { default: OpenAI } = await import('openai');
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not set');
    return;
  }

  const client = new OpenAI({ apiKey });
  const voiceDir = path.join(OUTPUT_DIR, 'voices');
  ensureDir(voiceDir);

  console.log('\n🎙️  Generating OpenAI voice previews...\n');

  for (const voice of OPENAI_VOICES) {
    const outputPath = path.join(voiceDir, `openai-${voice.id}.mp3`);

    if (fileExists(outputPath)) {
      console.log(`   ⏭️  Skipping ${voice.displayName} (already exists)`);
      continue;
    }

    try {
      console.log(`   🔊 Generating ${voice.displayName} (${voice.id})...`);

      const response = await client.audio.speech.create({
        model: 'tts-1-hd',
        voice: voice.id,
        input: PREVIEW_TEXT,
        response_format: 'mp3',
        speed: 0.9,
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);

      console.log(`   ✅ ${voice.displayName} saved`);
      await sleep(500); // Rate limiting
    } catch (error: any) {
      console.error(`   ❌ Failed to generate ${voice.displayName}:`, error.message);
    }
  }
}

async function generateElevenLabsVoicePreviews() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY not set');
    return;
  }

  const voiceDir = path.join(OUTPUT_DIR, 'voices');
  ensureDir(voiceDir);

  console.log('\n🎙️  Generating ElevenLabs voice previews...\n');

  for (const voice of ELEVENLABS_VOICES) {
    const outputPath = path.join(voiceDir, `elevenlabs-${voice.id.substring(0, 8)}.mp3`);

    if (fileExists(outputPath)) {
      console.log(`   ⏭️  Skipping ${voice.displayName} (already exists)`);
      continue;
    }

    try {
      console.log(`   🔊 Generating ${voice.displayName}...`);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: ELEVENLABS_PREVIEW_TEXT,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${await response.text()}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);

      // Apply 0.9x speed via ffmpeg atempo (ElevenLabs has no native speed param)
      console.log(`   🔄 Applying 0.9x speed adjustment...`);
      const tempPath = outputPath + '.tmp.mp3';
      execSync(`ffmpeg -y -i "${outputPath}" -filter:a "atempo=0.9" "${tempPath}" 2>/dev/null`);
      fs.renameSync(tempPath, outputPath);

      console.log(`   ✅ ${voice.displayName} saved`);
      await sleep(1000); // Rate limiting (ElevenLabs is stricter)
    } catch (error: any) {
      console.error(`   ❌ Failed to generate ${voice.displayName}:`, error.message);
    }
  }
}

// ============================================
// Solfeggio Preview Generation
// ============================================

function generateSolfeggioPreviews() {
  const solfeggioDir = path.join(OUTPUT_DIR, 'solfeggio');
  ensureDir(solfeggioDir);

  console.log('\n🎵 Generating Solfeggio frequency previews...\n');

  for (const freq of SOLFEGGIO_FREQUENCIES) {
    const outputPath = path.join(solfeggioDir, `solfeggio-${freq.hz}hz.mp3`);

    if (fileExists(outputPath)) {
      console.log(`   ⏭️  Skipping ${freq.hz} Hz (already exists)`);
      continue;
    }

    try {
      console.log(`   🎶 Generating ${freq.hz} Hz - ${freq.name}...`);

      // Generate a pure sine wave with fade in/out
      // Using stereo (-ac 2) for consistency
      const ffmpegCmd = `ffmpeg -f lavfi -i "sine=frequency=${freq.hz}:duration=${PREVIEW_DURATION}" -af "afade=t=in:st=0:d=1,afade=t=out:st=${PREVIEW_DURATION - 1.5}:d=1.5,volume=0.3" -ac 2 -b:a 192k "${outputPath}" -y 2>/dev/null`;

      execSync(ffmpegCmd);
      console.log(`   ✅ ${freq.hz} Hz saved`);
    } catch (error: any) {
      console.error(`   ❌ Failed to generate ${freq.hz} Hz:`, error.message);
    }
  }
}

// ============================================
// Binaural Beats Preview Generation
// ============================================

function generateBinauralPreviews() {
  const binauralDir = path.join(OUTPUT_DIR, 'binaural');
  ensureDir(binauralDir);

  console.log('\n🧠 Generating Binaural beats previews...\n');

  for (const band of BINAURAL_BANDS) {
    const outputPath = path.join(binauralDir, `binaural-${band.band}.mp3`);

    if (fileExists(outputPath)) {
      console.log(`   ⏭️  Skipping ${band.band} (already exists)`);
      continue;
    }

    try {
      console.log(`   🎧 Generating ${band.band} - ${band.name} (${band.beatHz} Hz beat)...`);

      // Binaural beats require different frequencies in left and right ear
      // Left ear: carrier frequency
      // Right ear: carrier + beat frequency
      const leftHz = band.carrierHz;
      const rightHz = band.carrierHz + band.beatHz;

      // Generate stereo binaural beat using FFmpeg
      // amerge combines two mono sources into stereo
      const ffmpegCmd = `ffmpeg -f lavfi -i "sine=frequency=${leftHz}:duration=${PREVIEW_DURATION}" -f lavfi -i "sine=frequency=${rightHz}:duration=${PREVIEW_DURATION}" -filter_complex "[0:a][1:a]amerge=inputs=2,afade=t=in:st=0:d=1,afade=t=out:st=${PREVIEW_DURATION - 1.5}:d=1.5,volume=0.25[out]" -map "[out]" -b:a 192k "${outputPath}" -y 2>/dev/null`;

      execSync(ffmpegCmd);
      console.log(`   ✅ ${band.band} saved (L: ${leftHz} Hz, R: ${rightHz} Hz)`);
    } catch (error: any) {
      console.error(`   ❌ Failed to generate ${band.band}:`, error.message);
    }
  }
}

// ============================================
// Generate Manifest
// ============================================

function generateManifest() {
  console.log('\n📋 Generating preview manifest...\n');

  const manifest = {
    generated: new Date().toISOString(),
    voices: {
      openai: OPENAI_VOICES.map(v => ({
        id: v.id,
        displayName: v.displayName,
        previewUrl: `/audio-previews/voices/openai-${v.id}.mp3`,
      })),
      elevenlabs: ELEVENLABS_VOICES.map(v => ({
        id: v.id,
        displayName: v.displayName,
        previewUrl: `/audio-previews/voices/elevenlabs-${v.id.substring(0, 8)}.mp3`,
      })),
    },
    solfeggio: SOLFEGGIO_FREQUENCIES.map(f => ({
      hz: f.hz,
      name: f.name,
      description: f.description,
      previewUrl: `/audio-previews/solfeggio/solfeggio-${f.hz}hz.mp3`,
    })),
    binaural: BINAURAL_BANDS.map(b => ({
      band: b.band,
      beatHz: b.beatHz,
      carrierHz: b.carrierHz,
      name: b.name,
      description: b.description,
      previewUrl: `/audio-previews/binaural/binaural-${b.band}.mp3`,
    })),
  };

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest saved to ${manifestPath}`);

  return manifest;
}

// ============================================
// Update Database with Preview URLs
// ============================================

async function updateVoiceCatalogPreviewUrls() {
  console.log('\n📦 Updating voice_catalog preview URLs...\n');

  // This would typically use Supabase MCP or direct client
  // For now, generate SQL that can be run manually

  const sqlStatements: string[] = [];

  for (const voice of OPENAI_VOICES) {
    const previewUrl = `/audio-previews/voices/openai-${voice.id}.mp3`;
    sqlStatements.push(
      `UPDATE public.voice_catalog SET preview_url = '${previewUrl}' WHERE provider_voice_id = '${voice.id}' AND provider = 'openai';`
    );
  }

  for (const voice of ELEVENLABS_VOICES) {
    const previewUrl = `/audio-previews/voices/elevenlabs-${voice.id.substring(0, 8)}.mp3`;
    sqlStatements.push(
      `UPDATE public.voice_catalog SET preview_url = '${previewUrl}' WHERE provider_voice_id = '${voice.id}' AND provider = 'elevenlabs';`
    );
  }

  const sqlPath = path.join(OUTPUT_DIR, 'update-preview-urls.sql');
  fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
  console.log(`   ✅ SQL file saved to ${sqlPath}`);
  console.log(`   Run this SQL in Supabase to update the database.`);
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const generateAll = args.includes('--all') || args.length === 0;
  const generateVoices = generateAll || args.includes('--voices');
  const generateSolfeggio = generateAll || args.includes('--solfeggio');
  const generateBinaural = generateAll || args.includes('--binaural');

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         MindScript Preview Audio Generator               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  ensureDir(OUTPUT_DIR);

  // Check for ffmpeg
  try {
    execSync('which ffmpeg', { stdio: 'ignore' });
  } catch {
    console.error('\n❌ ffmpeg is not installed. Please install it first.');
    console.error('   brew install ffmpeg (macOS)');
    console.error('   apt-get install ffmpeg (Ubuntu)');
    process.exit(1);
  }

  if (generateVoices) {
    await generateOpenAIVoicePreviews();
    await generateElevenLabsVoicePreviews();
  }

  if (generateSolfeggio) {
    generateSolfeggioPreviews();
  }

  if (generateBinaural) {
    generateBinauralPreviews();
  }

  // Always generate manifest
  generateManifest();

  // Generate SQL for database updates
  await updateVoiceCatalogPreviewUrls();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    Generation Complete!                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nPreviews saved to: ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Run the SQL in update-preview-urls.sql on your Supabase database');
  console.log('2. The previews are now available at /audio-previews/*');
}

main().catch(console.error);

# MindScript Audio Worker

Background worker for processing audio rendering jobs using FFmpeg.

## Overview

This worker:
1. Polls the Supabase `audio_job_queue` for pending jobs
2. Processes jobs with FFmpeg (TTS, tone generation, mixing)
3. Uploads rendered audio to Supabase Storage
4. Updates track records with audio URLs

## Premium Tone Quality

Solfeggio tones and binaural beats are enhanced with a **pink noise carrier layer** for warmer, more natural sound (instead of raw clinical sine waves).

## Local Development

### Prerequisites
- Node.js 20+
- FFmpeg installed locally
- Supabase project with audio_job_queue table

### Setup

```bash
cd infrastructure/heroku-audio-worker

# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env

# Test FFmpeg
npm run test:ffmpeg

# Run worker locally
npm run dev
```

## Heroku Deployment

### 1. Create App and Add Buildpacks

```bash
# Install Heroku CLI if needed
brew install heroku/brew/heroku

# Login
heroku login

# Create app
heroku create mindscript-audio-worker

# Add buildpacks (ORDER MATTERS - FFmpeg first)
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git -a mindscript-audio-worker
heroku buildpacks:add heroku/nodejs -a mindscript-audio-worker
```

### 2. Set Environment Variables

```bash
heroku config:set SUPABASE_URL="https://your-project.supabase.co" -a mindscript-audio-worker
heroku config:set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" -a mindscript-audio-worker
heroku config:set OPENAI_API_KEY="sk-..." -a mindscript-audio-worker
heroku config:set ELEVENLABS_API_KEY="..." -a mindscript-audio-worker
```

### 3. Deploy

```bash
# From the heroku-audio-worker directory
git init
git add .
git commit -m "Initial audio worker"

# Add Heroku remote
heroku git:remote -a mindscript-audio-worker

# Deploy
git push heroku main

# Scale worker dyno
heroku ps:scale worker=1 -a mindscript-audio-worker
```

### 4. Monitor

```bash
# View logs
heroku logs --tail -a mindscript-audio-worker

# Check health endpoint
curl https://mindscript-audio-worker.herokuapp.com/health
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-side only) |
| `OPENAI_API_KEY` | No* | For OpenAI TTS |
| `ELEVENLABS_API_KEY` | No* | For ElevenLabs TTS |
| `POLL_INTERVAL_MS` | No | Poll interval (default: 10000) |
| `MAX_JOBS_PER_CYCLE` | No | Max jobs per poll (default: 5) |

*At least one TTS API key required for voice synthesis.

## Job Payload Schema

```typescript
{
  script?: string;              // Text for TTS
  voice?: {
    provider: 'openai' | 'elevenlabs';
    id: string;                 // Voice ID
    model?: string;
    speed?: number;
  };
  backgroundMusic?: {
    url: string;                // Supabase storage URL
  };
  solfeggio?: {
    enabled: boolean;
    hz: 174 | 285 | 396 | 417 | 528 | 639 | 741 | 852 | 963;
  };
  binaural?: {
    enabled: boolean;
    carrierHz: number;          // 100-1000 Hz
    beatHz: number;             // 1-100 Hz (delta, theta, alpha, beta, gamma)
  };
  durationMin: number;          // 1-30 minutes
  carrierType?: 'pink' | 'brown' | 'none';  // Premium tone carrier
  carrierGainDb?: number;       // Carrier volume (default: -24)
  gains?: {
    voiceDb?: number;           // Default: -1
    musicDb?: number;           // Default: -10
    solfeggioDb?: number;       // Default: -18
    binauralDb?: number;        // Default: -20
  };
  fade?: {
    inMs?: number;              // Default: 1000
    outMs?: number;             // Default: 1500
  };
  safety?: {
    targetLufs?: number;        // Default: -16
  };
}
```

## Gain Staging

```
Voice (TTS)         → -1 dB   (loudest)
Background Music    → -10 dB
Solfeggio Tone      → -18 dB  (embedded in carrier)
Binaural Beat       → -20 dB  (embedded in carrier)
Pink Noise Carrier  → -24 dB  (subtle bed)
────────────────────────────────
Mixed → Normalized to -16 LUFS
```

## Troubleshooting

### FFmpeg Not Found
```bash
heroku buildpacks -a mindscript-audio-worker
# FFmpeg buildpack must be FIRST
```

### Jobs Stuck
Check for jobs stuck in "processing" state:
```sql
SELECT * FROM audio_job_queue
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '10 minutes';
```

### Worker Crashes
```bash
heroku logs --tail -a mindscript-audio-worker
heroku restart -a mindscript-audio-worker
```

## Architecture

See `docs/audio/HEROKU_FFMPEG_DEPLOYMENT.md` for full architecture details.

# Supabase Edge Functions for Audio Processing

This directory contains the Edge Functions that power the MindScript audio rendering pipeline.

## Functions

### 1. `audio-processor`
The main audio processing function that:
- Processes jobs from the `audio_job_queue` table
- Generates speech using OpenAI TTS or ElevenLabs
- Mixes background music, Solfeggio tones, and binaural beats
- Normalizes audio to target LUFS
- Uploads rendered audio to Supabase Storage
- Updates job progress in real-time

### 2. `audio-processor-worker`
A scheduled worker function that:
- Triggers audio processing for pending jobs
- Handles stuck job recovery
- Manages batch processing (up to 5 jobs per invocation)
- Scheduled to run every minute via pg_cron

## Setup

### Local Development

1. Copy the environment variables:
```bash
cp supabase/functions/.env.example supabase/functions/.env
```

2. Update the `.env` file with your credentials

3. Start the functions locally:
```bash
supabase functions serve audio-processor --env-file supabase/functions/.env
```

4. In another terminal, serve the worker:
```bash
supabase functions serve audio-processor-worker --env-file supabase/functions/.env
```

### Deployment

1. Deploy the functions:
```bash
supabase functions deploy audio-processor --no-verify-jwt
supabase functions deploy audio-processor-worker --no-verify-jwt
```

2. Set the environment secrets:
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set ELEVENLABS_API_KEY=your-key
supabase secrets set RESEND_API_KEY=re_your-key
```

3. Run the migrations to set up pg_cron scheduling:
```bash
supabase db push
```

## Audio Processing Pipeline

1. **Job Creation**: User submits render request → Job added to `audio_job_queue`
2. **Job Processing**: Worker picks up job using SKIP LOCKED pattern
3. **TTS Generation**: Script converted to speech using selected voice
4. **Audio Layers**:
   - Speech (primary layer)
   - Background music (optional, with volume control)
   - Solfeggio tones (optional, pure sine waves)
   - Binaural beats (optional, stereo separation for brainwave entrainment)
5. **Mixing & Normalization**: All layers mixed and normalized to target LUFS
6. **Upload**: Final audio uploaded to Supabase Storage
7. **Notification**: User notified of completion/failure

## Supported Features

### TTS Providers
- **OpenAI**: 6 voices (alloy, echo, fable, onyx, nova, shimmer)
- **ElevenLabs**: Custom voices with stability/similarity controls
- **Uploaded**: User's own voice (future implementation)

### Audio Frequencies
- **Solfeggio**: 174, 285, 396, 417, 528, 639, 741, 852, 963 Hz
- **Binaural Beats**:
  - Delta (0.5-4 Hz): Deep sleep
  - Theta (4-8 Hz): Meditation
  - Alpha (8-14 Hz): Relaxation
  - Beta (14-30 Hz): Focus
  - Gamma (30-100 Hz): Peak awareness

### Output Formats
- MP3 (128k, 192k, 320k bitrates)
- WAV (44.1kHz, 16-bit PCM)

## Database Schema

The functions rely on these key tables:
- `audio_job_queue`: Job queue with SKIP LOCKED support
- `tracks`: Track metadata
- `notifications_queue`: Email notification queue

## Testing

Run the test suite:
```bash
deno test --allow-net --allow-env supabase/functions/audio-processor/audio-processor.test.ts
```

## Monitoring

- Jobs stuck in 'processing' for >10 minutes are automatically reset
- Progress updates available via real-time subscriptions
- Failed jobs include error details for debugging

## Security

- Functions use service role key (server-side only)
- RLS policies enforce user data isolation
- Signed URLs for private audio access
- Input validation for all job parameters

## Performance

- Concurrent job processing with SKIP LOCKED
- Stereo enforcement (-ac 2) on all outputs
- Target -16 LUFS for consistent loudness
- Efficient temp file cleanup
- Progress tracking for long-running jobs
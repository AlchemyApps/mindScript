# Audio Worker Heroku Deployment Guide

## Overview

The MindScript audio processor requires FFmpeg for audio rendering (TTS processing, mixing, binaural beats, Solfeggio tones). **Supabase Edge Functions cannot spawn subprocesses**, making FFmpeg unavailable in that environment.

**Solution:** Deploy the audio worker to Heroku, which supports FFmpeg via buildpack.

## Why Heroku?

| Requirement | Heroku Support |
|-------------|----------------|
| FFmpeg binary | ✅ Via buildpack |
| Node.js runtime | ✅ Native |
| Background workers | ✅ Worker dynos |
| Environment variables | ✅ Config vars |
| HTTP endpoints | ✅ Web dynos |
| Supabase connectivity | ✅ Full access |

### Cost Comparison

| Platform | FFmpeg | Monthly Cost | Setup Complexity |
|----------|--------|--------------|------------------|
| **Heroku** | ✅ Buildpack | $7-25 | Low |
| Fly.io | ✅ Docker | $5-15 | Medium |
| Render | ✅ Docker | $7+ | Low |
| Railway | ✅ Docker | ~$5 | Low |
| Supabase Edge | ❌ No subprocess | N/A | N/A |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CURRENT FLOW                           │
└─────────────────────────────────────────────────────────────┘

  User → Builder → Stripe Checkout → Webhook
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  Supabase DB    │
                              │  audio_job_queue│
                              └────────┬────────┘
                                       │
                         pg_cron (every minute)
                                       │
                                       ▼
                         ┌─────────────────────────┐
                         │  Supabase Edge Function │
                         │  (audio-processor)      │
                         │  ❌ BLOCKED: No FFmpeg  │
                         └─────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      NEW FLOW (HEROKU)                      │
└─────────────────────────────────────────────────────────────┘

  User → Builder → Stripe Checkout → Webhook
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  Supabase DB    │
                              │  audio_job_queue│
                              └────────┬────────┘
                                       │
                    Option A: pg_cron POST to Heroku
                    Option B: Heroku polls queue
                                       │
                                       ▼
                         ┌─────────────────────────┐
                         │    Heroku Worker        │
                         │  ✅ Node.js + FFmpeg    │
                         │  - Fetch pending jobs   │
                         │  - Generate TTS         │
                         │  - Mix audio layers     │
                         │  - Upload to Supabase   │
                         └─────────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Supabase Storage│
                              │ audio-renders/  │
                              │ track-previews/ │
                              └─────────────────┘
```

## Deployment Steps

### 1. Create Heroku App

```bash
# Install Heroku CLI if needed
# brew install heroku/brew/heroku (macOS)
# Or: https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create mindscript-audio-worker

# Add buildpacks (ORDER MATTERS - FFmpeg first)
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git -a mindscript-audio-worker
heroku buildpacks:add heroku/nodejs -a mindscript-audio-worker
```

### 2. Create Worker Directory

Create a new directory for the Heroku worker:

```
infrastructure/heroku-audio-worker/
├── package.json
├── Procfile
├── worker.js
├── lib/
│   ├── audio-processor.js
│   ├── ffmpeg-utils.js
│   ├── tts-client.js
│   └── supabase-client.js
└── .env.example
```

### 3. Procfile

```procfile
worker: node worker.js
```

### 4. package.json

```json
{
  "name": "mindscript-audio-worker",
  "version": "1.0.0",
  "description": "MindScript Audio Processing Worker",
  "main": "worker.js",
  "engines": {
    "node": "20.x"
  },
  "scripts": {
    "start": "node worker.js",
    "dev": "node --watch worker.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "fluent-ffmpeg": "^2.1.2",
    "node-fetch": "^3.3.2"
  }
}
```

### 5. Environment Variables

Set these in Heroku Dashboard or via CLI:

```bash
# Supabase
heroku config:set SUPABASE_URL="https://your-project.supabase.co" -a mindscript-audio-worker
heroku config:set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" -a mindscript-audio-worker

# TTS APIs
heroku config:set OPENAI_API_KEY="sk-..." -a mindscript-audio-worker
heroku config:set ELEVENLABS_API_KEY="..." -a mindscript-audio-worker

# Optional
heroku config:set RESEND_API_KEY="..." -a mindscript-audio-worker
heroku config:set LOG_LEVEL="info" -a mindscript-audio-worker
```

### 6. Worker Implementation (worker.js)

```javascript
const { createClient } = require('@supabase/supabase-js');
const { processAudioJob } = require('./lib/audio-processor');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POLL_INTERVAL = 10000; // 10 seconds
const MAX_JOBS_PER_CYCLE = 5;

async function getNextJob() {
  const { data, error } = await supabase.rpc('get_next_pending_job');
  if (error) {
    console.error('Error fetching job:', error);
    return null;
  }
  return data;
}

async function processQueue() {
  console.log(`[${new Date().toISOString()}] Checking for pending jobs...`);

  let jobsProcessed = 0;

  while (jobsProcessed < MAX_JOBS_PER_CYCLE) {
    const job = await getNextJob();

    if (!job) {
      console.log('No pending jobs');
      break;
    }

    console.log(`Processing job ${job.job_id} for track ${job.track_id}`);

    try {
      await processAudioJob(job, supabase);
      jobsProcessed++;
      console.log(`Job ${job.job_id} completed successfully`);
    } catch (error) {
      console.error(`Job ${job.job_id} failed:`, error);

      await supabase.rpc('complete_job', {
        p_job_id: job.job_id,
        p_result: null,
        p_error: error.message
      });
    }
  }

  console.log(`Processed ${jobsProcessed} jobs this cycle`);
}

// Main loop
async function main() {
  console.log('MindScript Audio Worker starting...');
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);

  // Verify FFmpeg is available
  const { execSync } = require('child_process');
  try {
    const version = execSync('ffmpeg -version').toString().split('\n')[0];
    console.log(`FFmpeg available: ${version}`);
  } catch (e) {
    console.error('FFmpeg not found! Worker cannot process audio.');
    process.exit(1);
  }

  // Process immediately on start
  await processQueue();

  // Then poll on interval
  setInterval(processQueue, POLL_INTERVAL);
}

main().catch(console.error);
```

### 7. Deploy

```bash
cd infrastructure/heroku-audio-worker

# Initialize git if needed
git init
git add .
git commit -m "Initial audio worker"

# Add Heroku remote
heroku git:remote -a mindscript-audio-worker

# Deploy
git push heroku main

# Scale worker dyno
heroku ps:scale worker=1 -a mindscript-audio-worker

# View logs
heroku logs --tail -a mindscript-audio-worker
```

## Migration from Supabase Edge Functions

### What to Keep

- **Database RPC functions** (`get_next_pending_job`, `update_job_progress`, `complete_job`) - still used
- **Storage buckets** (`audio-renders`, `track-previews`) - still used
- **pg_cron schedule** - can be disabled or repurposed

### What to Change

1. **Disable pg_cron trigger** (optional):
   ```sql
   SELECT cron.unschedule('process-audio-jobs');
   ```

2. **Or update pg_cron to POST to Heroku** (alternative to polling):
   ```sql
   SELECT cron.schedule(
     'process-audio-jobs',
     '* * * * *',
     $$
     SELECT net.http_post(
       url := 'https://mindscript-audio-worker.herokuapp.com/process',
       headers := '{"Authorization": "Bearer your-secret-token"}'::jsonb
     )
     $$
   );
   ```

### Edge Functions to Deprecate

- `supabase/functions/audio-processor/` - Move logic to Heroku worker
- `supabase/functions/audio-processor-worker/` - No longer needed

## Monitoring

### Heroku Dashboard
- View dyno metrics (memory, CPU)
- Check logs in real-time
- Set up alerts for crashes

### Logging
```bash
# Real-time logs
heroku logs --tail -a mindscript-audio-worker

# Recent logs
heroku logs -n 500 -a mindscript-audio-worker
```

### Health Check Endpoint (Optional)

Add to worker for uptime monitoring:

```javascript
const http = require('http');

http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  }
}).listen(process.env.PORT || 3000);
```

## Scaling

### Vertical (Dyno Size)
```bash
# Upgrade dyno type for more memory/CPU
heroku ps:type worker=standard-1x -a mindscript-audio-worker
heroku ps:type worker=standard-2x -a mindscript-audio-worker
```

### Horizontal (Multiple Workers)
```bash
# Run multiple worker dynos
heroku ps:scale worker=2 -a mindscript-audio-worker
```

Note: With multiple workers, the `get_next_pending_job` RPC uses `SKIP LOCKED` to prevent race conditions.

## Troubleshooting

### FFmpeg Not Found
```bash
# Verify buildpack order
heroku buildpacks -a mindscript-audio-worker
# FFmpeg buildpack must be FIRST

# Rebuild
heroku builds:create -a mindscript-audio-worker
```

### Worker Keeps Restarting
- Check logs for errors
- Verify environment variables are set
- Ensure Supabase credentials are valid

### Jobs Stuck in "processing"
The worker resets stuck jobs (processing > 10 minutes). Check:
```sql
SELECT * FROM audio_job_queue
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '10 minutes';
```

## Cost Optimization

| Dyno Type | Cost | Best For |
|-----------|------|----------|
| Basic | $7/mo | Development, low volume |
| Standard-1X | $25/mo | Production, moderate volume |
| Standard-2X | $50/mo | High volume, faster processing |

For cost savings:
- Use Basic dyno during development
- Scale to Standard for production
- Consider Eco dynos ($5/mo) if occasional sleeping is acceptable

## Security Checklist

- [ ] Service role key stored as Heroku config var (not in code)
- [ ] API keys stored as config vars
- [ ] No credentials in git repository
- [ ] Heroku app has team/organization access controls
- [ ] Consider IP allowlisting for Supabase if needed

## Next Steps After Deployment

1. **Test single job processing**
   - Create test track via builder
   - Verify job appears in queue
   - Check Heroku logs for processing
   - Confirm audio file in Supabase storage

2. **Test full E2E flow**
   - Builder → Checkout → Payment → Track creation → Render → Library playback

3. **Monitor for 24-48 hours**
   - Watch for memory leaks
   - Check job completion rates
   - Verify audio quality

4. **Production hardening**
   - Set up error alerting (Sentry, etc.)
   - Configure auto-restart on failure
   - Add metrics/monitoring

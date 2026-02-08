/**
 * MindScript Audio Worker
 *
 * Background worker for processing audio rendering jobs.
 * Polls the Supabase job queue and processes jobs using FFmpeg.
 *
 * Heroku Deployment:
 * 1. heroku create mindscript-audio-worker
 * 2. heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
 * 3. heroku buildpacks:add heroku/nodejs
 * 4. heroku config:set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... etc.
 * 5. git push heroku main
 * 6. heroku ps:scale worker=1
 */

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch {
    // dotenv not installed in production
  }
}

const http = require('http');
const { execSync } = require('child_process');
const { getClient, getNextPendingJob } = require('./lib/supabase-client');
const { processAudioJob, validateJobPayload } = require('./lib/audio-processor');
const { verifyFFmpeg } = require('./lib/ffmpeg-utils');

// Configuration
const FALLBACK_POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '300000', 10); // 5 min fallback
const MAX_JOBS_PER_CYCLE = parseInt(process.env.MAX_JOBS_PER_CYCLE || '5', 10);
const PORT = process.env.WORKER_PORT || process.env.PORT || 3002;

// Worker state
let isProcessing = false;
let totalJobsProcessed = 0;
let totalJobsFailed = 0;
let lastPollTime = null;
let workerStartTime = null;

/**
 * Health check HTTP server (for Heroku)
 */
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: workerStartTime ? Math.floor((Date.now() - workerStartTime) / 1000) : 0,
        jobsProcessed: totalJobsProcessed,
        jobsFailed: totalJobsFailed,
        lastPoll: lastPollTime?.toISOString(),
        isProcessing,
      }));
    } else if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end([
        `# HELP mindscript_jobs_processed Total jobs processed`,
        `# TYPE mindscript_jobs_processed counter`,
        `mindscript_jobs_processed ${totalJobsProcessed}`,
        `# HELP mindscript_jobs_failed Total jobs failed`,
        `# TYPE mindscript_jobs_failed counter`,
        `mindscript_jobs_failed ${totalJobsFailed}`,
        `# HELP mindscript_worker_uptime Worker uptime in seconds`,
        `# TYPE mindscript_worker_uptime gauge`,
        `mindscript_worker_uptime ${workerStartTime ? Math.floor((Date.now() - workerStartTime) / 1000) : 0}`,
      ].join('\n'));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(PORT, () => {
    console.log(`[Worker] Health server listening on port ${PORT}`);
  });

  return server;
}

/**
 * Process the job queue
 */
async function processQueue() {
  if (isProcessing) {
    console.log('[Worker] Already processing, skipping cycle');
    return;
  }

  isProcessing = true;
  lastPollTime = new Date();
  let jobsProcessedThisCycle = 0;

  console.log(`\n[${lastPollTime.toISOString()}] Checking for pending jobs...`);

  try {
    while (jobsProcessedThisCycle < MAX_JOBS_PER_CYCLE) {
      // Get next pending job
      const job = await getNextPendingJob();

      if (!job) {
        console.log('[Worker] No pending jobs');
        break;
      }

      console.log(`[Worker] Found job ${job.job_id} for track ${job.track_id}`);

      // Validate payload
      const validation = validateJobPayload(job.payload);
      if (!validation.isValid) {
        console.error(`[Worker] Invalid job payload:`, validation.errors);
        totalJobsFailed++;
        continue;
      }

      // Process the job
      try {
        await processAudioJob(job);
        jobsProcessedThisCycle++;
        totalJobsProcessed++;
        console.log(`[Worker] Job ${job.job_id} completed successfully`);
      } catch (error) {
        console.error(`[Worker] Job ${job.job_id} failed:`, error.message);
        totalJobsFailed++;
      }
    }

    console.log(`[Worker] Processed ${jobsProcessedThisCycle} jobs this cycle`);

  } catch (error) {
    console.error('[Worker] Queue processing error:', error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Verify environment and dependencies
 */
function verifyEnvironment() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const optional = [
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('[Worker] Missing required environment variables:', missing.join(', '));
    return false;
  }

  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn('[Worker] Missing optional environment variables:', missingOptional.join(', '));
    console.warn('[Worker] TTS functionality may be limited');
  }

  return true;
}

/**
 * Main entry point
 */
async function main() {
  console.log('===============================================');
  console.log('  MindScript Audio Worker');
  console.log('===============================================');
  console.log('');

  workerStartTime = Date.now();

  // Verify environment
  if (!verifyEnvironment()) {
    console.error('[Worker] Environment verification failed');
    process.exit(1);
  }
  console.log('[Worker] Environment variables verified');

  // Verify FFmpeg
  if (!verifyFFmpeg()) {
    console.error('[Worker] FFmpeg verification failed');
    process.exit(1);
  }

  // Start health check server
  const server = startHealthServer();

  // Configuration summary
  console.log('[Worker] Configuration:');
  console.log(`  - Mode: Realtime subscription + ${FALLBACK_POLL_INTERVAL / 1000}s fallback poll`);
  console.log(`  - Max jobs per cycle: ${MAX_JOBS_PER_CYCLE}`);
  console.log(`  - Health port: ${PORT}`);
  console.log('');

  // Subscribe to new jobs via Supabase Realtime
  const supabase = getClient();
  const channel = supabase
    .channel('audio-job-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'audio_job_queue' },
      (payload) => {
        console.log(`[Worker] Realtime: new job inserted (${payload.new?.id || 'unknown'})`);
        processQueue();
      }
    )
    .subscribe((status) => {
      console.log(`[Worker] Realtime subscription: ${status}`);
    });

  // Handle shutdown gracefully
  const shutdown = () => {
    console.log('\n[Worker] Shutting down...');
    supabase.removeChannel(channel);
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Process immediately on start (pick up anything queued while offline)
  await processQueue();

  // Fallback poll as safety net for missed realtime events
  console.log(`[Worker] Listening for new jobs via Realtime (fallback poll every ${FALLBACK_POLL_INTERVAL / 1000}s)...`);
  setInterval(processQueue, FALLBACK_POLL_INTERVAL);
}

// Start the worker
main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});

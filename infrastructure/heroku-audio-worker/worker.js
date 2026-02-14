/**
 * MindScript Audio Worker
 *
 * Background worker for processing audio rendering jobs.
 * Supports dual-environment mode: a single worker instance serves both
 * dev and prod Supabase databases, with prod jobs prioritized.
 *
 * Environment variables:
 *   Dev:  SUPABASE_DEV_URL / SUPABASE_DEV_SERVICE_ROLE_KEY
 *         (falls back to SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
 *   Prod: SUPABASE_PROD_URL / SUPABASE_PROD_SERVICE_ROLE_KEY
 *
 * Heroku Deployment:
 * 1. heroku create mindscript-audio-worker
 * 2. heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
 * 3. heroku buildpacks:add heroku/nodejs
 * 4. heroku config:set SUPABASE_DEV_URL=... SUPABASE_DEV_SERVICE_ROLE_KEY=... etc.
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
const { createEnvironmentClient } = require('./lib/supabase-client');
const { processAudioJob, validateJobPayload } = require('./lib/audio-processor');
const { verifyFFmpeg } = require('./lib/ffmpeg-utils');

// Configuration
const FALLBACK_POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '300000', 10); // 5 min fallback
const MAX_JOBS_PER_CYCLE = parseInt(process.env.MAX_JOBS_PER_CYCLE || '5', 10);
const PORT = process.env.WORKER_PORT || process.env.PORT || 3002;

// Per-environment state
const environments = {};
let workerStartTime = null;

/**
 * Initialize an environment if credentials are available.
 * Returns the envClient or null.
 */
function initEnvironment(envName, url, key) {
  if (!url || !key) return null;

  const envClient = createEnvironmentClient(url, key, envName);

  environments[envName] = {
    envClient,
    isProcessing: false,
    totalProcessed: 0,
    totalFailed: 0,
    lastPoll: null,
    channel: null,
    enabled: true,
  };

  console.log(`[Worker] ${envName} environment initialized (${url})`);
  return envClient;
}

/**
 * Health check HTTP server (for Heroku)
 */
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const envStats = {};
      for (const [name, env] of Object.entries(environments)) {
        envStats[name.toLowerCase()] = {
          enabled: env.enabled,
          isProcessing: env.isProcessing,
          totalProcessed: env.totalProcessed,
          totalFailed: env.totalFailed,
          lastPoll: env.lastPoll?.toISOString() || null,
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: workerStartTime ? Math.floor((Date.now() - workerStartTime) / 1000) : 0,
        environments: envStats,
        totalProcessed: Object.values(environments).reduce((s, e) => s + e.totalProcessed, 0),
        totalFailed: Object.values(environments).reduce((s, e) => s + e.totalFailed, 0),
      }));
    } else if (req.url === '/metrics') {
      const lines = [
        `# HELP mindscript_worker_uptime Worker uptime in seconds`,
        `# TYPE mindscript_worker_uptime gauge`,
        `mindscript_worker_uptime ${workerStartTime ? Math.floor((Date.now() - workerStartTime) / 1000) : 0}`,
      ];
      for (const [name, env] of Object.entries(environments)) {
        const label = name.toLowerCase();
        lines.push(
          `# HELP mindscript_jobs_processed_${label} Total jobs processed (${label})`,
          `# TYPE mindscript_jobs_processed_${label} counter`,
          `mindscript_jobs_processed_${label} ${env.totalProcessed}`,
          `# HELP mindscript_jobs_failed_${label} Total jobs failed (${label})`,
          `# TYPE mindscript_jobs_failed_${label} counter`,
          `mindscript_jobs_failed_${label} ${env.totalFailed}`,
        );
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(lines.join('\n'));
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
 * Process the job queue for a specific environment
 */
async function processEnvironmentQueue(envName) {
  const env = environments[envName];
  if (!env || !env.enabled) return;

  if (env.isProcessing) {
    console.log(`[Worker] [${envName}] Already processing, skipping cycle`);
    return;
  }

  env.isProcessing = true;
  env.lastPoll = new Date();
  let jobsProcessedThisCycle = 0;

  console.log(`\n[${env.lastPoll.toISOString()}] [${envName}] Checking for pending jobs...`);

  try {
    while (jobsProcessedThisCycle < MAX_JOBS_PER_CYCLE) {
      const job = await env.envClient.getNextPendingJob();

      if (!job) {
        console.log(`[Worker] [${envName}] No pending jobs`);
        break;
      }

      console.log(`[Worker] [${envName}] Found job ${job.job_id} for track ${job.track_id}`);

      const validation = validateJobPayload(job.payload);
      if (!validation.isValid) {
        console.error(`[Worker] [${envName}] Invalid job payload:`, validation.errors);
        env.totalFailed++;
        continue;
      }

      try {
        await processAudioJob(job, env.envClient);
        jobsProcessedThisCycle++;
        env.totalProcessed++;
        console.log(`[Worker] [${envName}] Job ${job.job_id} completed successfully`);
      } catch (error) {
        console.error(`[Worker] [${envName}] Job ${job.job_id} failed:`, error.message);
        env.totalFailed++;
      }
    }

    console.log(`[Worker] [${envName}] Processed ${jobsProcessedThisCycle} jobs this cycle`);

  } catch (error) {
    console.error(`[Worker] [${envName}] Queue processing error:`, error.message);
  } finally {
    env.isProcessing = false;
  }
}

/**
 * Process all environment queues with prod priority
 */
async function processAllQueues() {
  // Process PROD first (priority), then DEV
  if (environments.PROD) {
    await processEnvironmentQueue('PROD');
  }
  if (environments.DEV) {
    await processEnvironmentQueue('DEV');
  }
}

/**
 * Subscribe to Realtime INSERT events for an environment
 */
function subscribeToRealtime(envName) {
  const env = environments[envName];
  if (!env) return;

  const channel = env.envClient.client
    .channel(`audio-job-inserts-${envName.toLowerCase()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'audio_job_queue' },
      (payload) => {
        console.log(`[Worker] [${envName}] Realtime: new job inserted (${payload.new?.id || 'unknown'})`);
        processEnvironmentQueue(envName);
      }
    )
    .subscribe((status) => {
      console.log(`[Worker] [${envName}] Realtime subscription: ${status}`);
    });

  env.channel = channel;
}

/**
 * Verify environment variables and determine which environments are available
 */
function verifyEnvironment() {
  // Dev: prefer new var names, fall back to legacy
  const devUrl = process.env.SUPABASE_DEV_URL || process.env.SUPABASE_URL;
  const devKey = process.env.SUPABASE_DEV_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Prod: only new var names (no fallback to avoid accidentally pointing at dev)
  const prodUrl = process.env.SUPABASE_PROD_URL;
  const prodKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;

  if (!devUrl || !devKey) {
    console.error('[Worker] Missing DEV Supabase credentials (SUPABASE_DEV_URL/SUPABASE_URL + key)');
    return false;
  }

  initEnvironment('DEV', devUrl, devKey);

  if (prodUrl && prodKey) {
    initEnvironment('PROD', prodUrl, prodKey);
  } else {
    console.warn('[Worker] PROD Supabase credentials not set — running in single-environment (DEV) mode');
  }

  // Check optional TTS keys
  const optional = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY'];
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
  console.log('  MindScript Audio Worker (Dual-Environment)');
  console.log('===============================================');
  console.log('');

  workerStartTime = Date.now();

  // Verify environment
  if (!verifyEnvironment()) {
    console.error('[Worker] Environment verification failed');
    process.exit(1);
  }

  const envNames = Object.keys(environments);
  console.log(`[Worker] Active environments: ${envNames.join(', ')}`);

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
  console.log(`  - Environments: ${envNames.join(', ')}`);
  if (environments.PROD) {
    console.log('  - Priority: PROD > DEV');
  }
  console.log('');

  // Subscribe to Realtime for each environment
  for (const envName of envNames) {
    subscribeToRealtime(envName);
  }

  // Handle shutdown gracefully
  const shutdown = () => {
    console.log('\n[Worker] Shutting down...');
    for (const [name, env] of Object.entries(environments)) {
      if (env.channel) {
        console.log(`[Worker] Removing Realtime channel for ${name}`);
        env.envClient.client.removeChannel(env.channel);
      }
    }
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Process immediately on start (pick up anything queued while offline)
  await processAllQueues();

  // Fallback poll as safety net for missed realtime events
  console.log(`[Worker] Listening for new jobs via Realtime (fallback poll every ${FALLBACK_POLL_INTERVAL / 1000}s)...`);
  setInterval(processAllQueues, FALLBACK_POLL_INTERVAL);
}

// Start the worker
main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});

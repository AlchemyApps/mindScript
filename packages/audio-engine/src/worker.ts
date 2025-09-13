#!/usr/bin/env node

/**
 * Audio Job Worker
 * 
 * This worker process polls the audio job queue and processes jobs.
 * It can be run as a standalone process or managed by a process manager like PM2.
 * 
 * Usage:
 *   npm run worker
 *   NODE_ENV=production npm run worker
 *   WORKER_ID=worker-1 MAX_JOBS=4 npm run worker
 * 
 * Environment Variables:
 *   - WORKER_ID: Unique identifier for this worker (default: generated)
 *   - MAX_JOBS: Maximum concurrent jobs (default: 2)
 *   - POLL_INTERVAL: Poll interval in ms (default: 5000)
 *   - IDLE_TIMEOUT: Idle timeout in ms (default: 60000, 0 to disable)
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_KEY: Supabase service role key
 *   - OPENAI_API_KEY: OpenAI API key for TTS
 *   - ELEVENLABS_API_KEY: ElevenLabs API key for TTS
 */

import { QueueManager } from "./queue/QueueManager";
import { JobOrchestrator } from "./jobs/JobOrchestrator";
import * as crypto from "crypto";

// Configuration from environment
const config = {
  workerId: process.env.WORKER_ID || `worker-${crypto.randomBytes(4).toString("hex")}`,
  maxConcurrentJobs: parseInt(process.env.MAX_JOBS || "2", 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL || "5000", 10),
  idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT || "60000", 10),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
};

// Validate required environment variables
if (!config.supabaseUrl || !config.supabaseKey) {
  console.error("❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY");
  process.exit(1);
}

// Initialize queue manager
const queueManager = new QueueManager(config.supabaseUrl, config.supabaseKey);

// Initialize orchestrator
const orchestrator = new JobOrchestrator({
  queueManager,
  workerId: config.workerId,
  maxConcurrentJobs: config.maxConcurrentJobs,
  pollIntervalMs: config.pollIntervalMs,
  idleTimeoutMs: config.idleTimeoutMs,
  statsIntervalMs: 30000, // Report stats every 30 seconds
});

// Setup event listeners
orchestrator.on("start", ({ workerId }) => {
  console.log(`✅ Worker ${workerId} started`);
  console.log(`   Max concurrent jobs: ${config.maxConcurrentJobs}`);
  console.log(`   Poll interval: ${config.pollIntervalMs}ms`);
  console.log(`   Idle timeout: ${config.idleTimeoutMs}ms`);
});

orchestrator.on("stop", ({ workerId }) => {
  console.log(`🛑 Worker ${workerId} stopped`);
});

orchestrator.on("jobStart", ({ jobId, workerId }) => {
  console.log(`🎵 Starting job ${jobId} on worker ${workerId}`);
});

orchestrator.on("jobComplete", ({ jobId, duration }) => {
  const durationSec = (duration / 1000).toFixed(2);
  console.log(`✅ Job ${jobId} completed in ${durationSec}s`);
});

orchestrator.on("jobFailed", ({ jobId, error }) => {
  console.error(`❌ Job ${jobId} failed: ${error}`);
});

orchestrator.on("statistics", (stats) => {
  console.log("📊 Statistics:");
  console.log(`   Total processed: ${stats.totalProcessed}`);
  console.log(`   Success: ${stats.successCount}`);
  console.log(`   Failed: ${stats.failureCount}`);
  console.log(`   Currently processing: ${stats.currentlyProcessing}`);
  if (stats.averageProcessingTime > 0) {
    const avgSec = (stats.averageProcessingTime / 1000).toFixed(2);
    console.log(`   Average processing time: ${avgSec}s`);
  }
  const uptimeMin = Math.floor(stats.uptime / 60000);
  console.log(`   Uptime: ${uptimeMin} minutes`);
});

orchestrator.on("idle", ({ duration }) => {
  const durationSec = (duration / 1000).toFixed(0);
  console.log(`💤 Worker idle for ${durationSec}s, shutting down...`);
});

orchestrator.on("error", (error) => {
  console.error("⚠️ Worker error:", error);
});

orchestrator.on("signal", ({ signal }) => {
  console.log(`📶 Received signal: ${signal}, shutting down gracefully...`);
});

orchestrator.on("shutdown", ({ message }) => {
  console.log(`🔄 ${message}`);
});

// Health check endpoint (optional - for monitoring)
if (process.env.HEALTH_PORT) {
  const http = require("http");
  const port = parseInt(process.env.HEALTH_PORT, 10);
  
  const server = http.createServer(async (req: any, res: any) => {
    if (req.url === "/health") {
      const health = await orchestrator.getHealth();
      res.writeHead(health.status === "healthy" ? 200 : 503, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(health));
    } else if (req.url === "/stats") {
      const stats = orchestrator.getStatistics();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stats));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  
  server.listen(port, () => {
    console.log(`🏥 Health check endpoint available at http://localhost:${port}/health`);
  });
}

// Start the worker
async function start() {
  try {
    console.log("🚀 Starting audio job worker...");
    await orchestrator.start();
  } catch (error) {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught exception:", error);
  orchestrator.stop().then(() => process.exit(1));
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled rejection at:", promise, "reason:", reason);
  orchestrator.stop().then(() => process.exit(1));
});

// Start the worker
start();
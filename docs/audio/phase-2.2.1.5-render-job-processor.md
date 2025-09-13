# Phase 2.2.1.5: Render Job Processor

## Overview

The Render Job Processor orchestrates the complete audio processing pipeline for MindScript, handling TTS synthesis, tone generation, mixing, normalization, and storage upload with comprehensive progress tracking and error recovery.

## Architecture

### Core Components

#### 1. AudioJobProcessor (`src/jobs/AudioJobProcessor.ts`)
The main orchestrator that processes AudioJobs end-to-end:
- **Voice Generation**: Handles OpenAI/ElevenLabs TTS or uploaded voice files
- **Asset Management**: Downloads and validates background music files
- **Tone Generation**: Creates Solfeggio and Binaural beat layers
- **Audio Mixing**: Combines all layers with proper gain staging
- **Normalization**: Ensures consistent loudness (-16 LUFS target)
- **Format Conversion**: Outputs to MP3 or WAV format
- **Storage Upload**: Handles public/private Supabase storage

Key Features:
- Text chunking for long scripts (>5000 chars)
- Retry logic with exponential backoff
- Partial failure recovery (continues without optional layers)
- Stereo enforcement on all outputs
- Temp file cleanup even on crash

#### 2. ProgressTracker (`src/jobs/ProgressTracker.ts`)
Manages granular progress tracking across pipeline stages:

```typescript
const PROGRESS_STAGES = {
  INITIALIZING: { weight: 5, message: "Initializing job" },
  DOWNLOADING_ASSETS: { weight: 10, message: "Downloading assets" },
  GENERATING_VOICE: { weight: 30, message: "Generating voice" },
  GENERATING_TONES: { weight: 10, message: "Creating tones" },
  MIXING_AUDIO: { weight: 25, message: "Mixing audio layers" },
  NORMALIZING: { weight: 10, message: "Normalizing audio" },
  UPLOADING: { weight: 10, message: "Uploading to storage" }
};
```

Features:
- Weighted progress calculation
- Stage-based tracking with auto-advance
- Custom message support
- Event emission for real-time updates
- Error tracking per stage
- Elapsed time tracking

#### 3. StorageUploader (`src/storage/StorageUploader.ts`)
Handles Supabase Storage integration:
- **Bucket Management**: Separate public/private buckets
- **Signed URLs**: Automatic generation for private content
- **Retry Logic**: Up to 5 retries with exponential backoff
- **Stream Support**: For large file uploads
- **Organization**: Date-based folder structure
- **Progress Tracking**: Real-time upload progress

#### 4. JobOrchestrator (`src/jobs/JobOrchestrator.ts`)
High-level coordinator for worker processes:
- **Queue Polling**: Fetches jobs from Supabase queue
- **Concurrency Control**: Manages parallel job processing
- **Lifecycle Management**: Handles job status transitions
- **Graceful Shutdown**: Waits for active jobs to complete
- **Statistics Tracking**: Success/failure rates, processing times
- **Health Monitoring**: Queue connectivity and worker status

## Usage

### Processing a Single Job

```typescript
import { AudioJobProcessor } from "@mindscript/audio-engine";

const processor = new AudioJobProcessor({
  maxDurationMinutes: 15,
  targetLufs: -16,
  ttsChunkSize: 4500
});

const job: AudioJobQueue = {
  id: "job-123",
  payload: {
    type: "render",
    projectData: {
      scriptText: "Your meditation script here",
      voiceRef: "openai:nova",
      durationMin: 10,
      layers: {
        voice: { enabled: true, provider: "openai", voiceCode: "nova" },
        background: { enabled: true, trackUrl: "https://..." },
        solfeggio: { enabled: true, hz: 528 },
        binaural: { enabled: true, band: "theta", beatHz: 7 }
      }
    },
    outputOptions: {
      format: "mp3",
      quality: "high",
      storageLocation: "private"
    }
  }
};

const result = await processor.processJob(job);
if (result.success) {
  console.log("Output URL:", result.data.outputUrl);
  console.log("Metadata:", result.data.metadata);
}
```

### Running the Worker

```bash
# Basic worker
npm run worker

# Development mode with auto-reload
npm run worker:dev

# Production with custom configuration
WORKER_ID=worker-1 MAX_JOBS=4 NODE_ENV=production npm run worker

# With health check endpoint
HEALTH_PORT=3001 npm run worker
```

### Progress Tracking

```typescript
const progressTracker = new ProgressTracker(jobId, {
  updateCallback: async (update) => {
    await queueManager.updateProgress(update);
  },
  eventEmitter: jobEventEmitter
});

// Listen to progress events
jobEventEmitter.on("progress", ({ stage, progress, message }) => {
  console.log(`[${stage}] ${progress}% - ${message}`);
});

jobEventEmitter.on("stageComplete", ({ stage, duration }) => {
  console.log(`Stage ${stage} completed in ${duration}ms`);
});
```

## Configuration

### Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# TTS Providers (at least one required)
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...

# Worker Configuration
WORKER_ID=worker-1          # Unique worker identifier
MAX_JOBS=2                  # Max concurrent jobs
POLL_INTERVAL=5000          # Queue poll interval (ms)
IDLE_TIMEOUT=60000          # Shutdown after idle (ms)

# Audio Processing
TARGET_LUFS=-16             # Target loudness
MAX_DURATION_MINUTES=15     # Maximum job duration
TTS_CHUNK_SIZE=4500         # Max chars per TTS request
```

## Error Handling

### Retry Strategy

1. **TTS Calls**: 3 retries with exponential backoff
2. **Storage Uploads**: 5 retries with increasing delays
3. **Asset Downloads**: Single attempt, continues without asset

### Failure Recovery

- **Missing Background Music**: Job continues without music layer
- **Tone Generation Failure**: Logs error and continues
- **TTS Provider Unavailable**: Falls back to alternative provider
- **Upload Failure**: Retries with different bucket if configured

### Cleanup Guarantees

- Temp files cleaned on success
- Temp files cleaned on failure
- Cleanup handlers for SIGTERM/SIGINT
- Process exit cleanup (best effort)

## Testing

### Unit Tests

```bash
# Test individual components
npm test tests/jobs/ProgressTracker.test.ts
npm test tests/jobs/AudioJobProcessor.test.ts
npm test tests/storage/StorageUploader.test.ts
npm test tests/jobs/JobOrchestrator.test.ts
```

### Integration Tests

```bash
# Test complete pipeline
npm test tests/integration/JobProcessingPipeline.test.ts
```

### Coverage

```bash
npm run test:coverage

# Expected coverage
# - ProgressTracker: 100%
# - StorageUploader: 95%+
# - AudioJobProcessor: 90%+
# - JobOrchestrator: 90%+
```

## Performance

### Optimization Strategies

1. **Concurrent Processing**: Parallel generation of tones
2. **Stream Processing**: Large files handled as streams
3. **Caching**: TTS results cached by content hash
4. **Connection Pooling**: Reused Supabase connections
5. **Temp File Management**: Automatic cleanup prevents disk bloat

### Benchmarks

- **TTS Generation**: ~2-3 seconds per 1000 characters
- **Solfeggio/Binaural**: <1 second for 15-minute track
- **Audio Mixing**: ~5 seconds for 4-layer 10-minute mix
- **Normalization**: ~2 seconds for 10-minute audio
- **Upload**: Depends on file size and network

## Monitoring

### Health Check Endpoint

```typescript
// GET http://localhost:3001/health
{
  "status": "healthy",
  "uptime": 3600000,
  "activeJobs": 2,
  "queueConnected": true
}

// GET http://localhost:3001/stats
{
  "totalProcessed": 150,
  "successCount": 145,
  "failureCount": 5,
  "averageProcessingTime": 12500,
  "currentlyProcessing": 2,
  "uptime": 3600000
}
```

### Logging

The worker provides comprehensive logging:
- Job lifecycle events
- Progress updates
- Error details with stack traces
- Performance metrics
- Resource usage

## Production Deployment

### Process Management (PM2)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "audio-worker",
    script: "./dist/worker.js",
    instances: 2,
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      MAX_JOBS: 3,
      IDLE_TIMEOUT: 0 // Disable idle timeout in production
    },
    max_memory_restart: "1G",
    error_file: "./logs/error.log",
    out_file: "./logs/output.log"
  }]
};
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/worker.js"]
```

### Scaling Considerations

1. **Horizontal Scaling**: Run multiple workers with unique IDs
2. **Queue Partitioning**: Assign workers to specific priority levels
3. **Resource Limits**: Set memory/CPU limits per worker
4. **Auto-scaling**: Scale workers based on queue depth
5. **Monitoring**: Track queue depth, processing times, error rates

## Troubleshooting

### Common Issues

1. **"TTS provider not configured"**
   - Ensure OPENAI_API_KEY or ELEVENLABS_API_KEY is set
   - Check API key validity

2. **"Failed to upload: 413 Payload Too Large"**
   - Check Supabase storage limits
   - Consider chunked upload for large files

3. **"Maximum call stack size exceeded"**
   - Check for circular dependencies
   - Ensure proper async/await usage

4. **Worker idle timeout**
   - Increase IDLE_TIMEOUT or set to 0
   - Check queue connectivity

5. **Memory leaks**
   - Ensure temp file cleanup
   - Monitor with `--inspect` flag

## Future Enhancements

1. **GPU Acceleration**: For faster audio processing
2. **Distributed Processing**: Split large jobs across workers
3. **Smart Caching**: Content-aware caching strategies
4. **Priority Lanes**: Separate queues for different priorities
5. **Real-time Progress**: WebSocket-based progress updates
6. **Cost Tracking**: Per-job cost calculation
7. **Quality Metrics**: Automatic audio quality assessment
8. **Fallback Providers**: Multiple TTS provider failover

## API Reference

See individual component documentation:
- [AudioJobProcessor API](./api/AudioJobProcessor.md)
- [ProgressTracker API](./api/ProgressTracker.md)
- [StorageUploader API](./api/StorageUploader.md)
- [JobOrchestrator API](./api/JobOrchestrator.md)
# Audio Engine Documentation

## Overview

The MindScript Audio Engine is a professional-grade audio processing system built on FFmpeg, designed to handle complex audio job pipelines with mandatory stereo enforcement. It processes TTS synthesis, background music mixing, silence insertion, and tone generation with broadcast-quality standards.

## Core Requirements

### Stereo Enforcement Protocol

**CRITICAL**: All audio outputs MUST be stereo (2 channels). This is enforced at every stage:

- All FFmpeg operations use the `-ac 2` flag
- Audio validation functions verify stereo compliance before job completion
- Mono and multi-channel audio is automatically converted to stereo
- Any operation that produces non-stereo output will fail validation

### Audio Quality Standards

- **Target Loudness**: -16 LUFS (broadcast standard)
- **Sample Rate**: 44.1 kHz (CD quality)
- **Bit Rate**: 192 kbps for MP3, lossless for WAV
- **Fade Defaults**: 1000ms in, 1500ms out

## Architecture

### Core Components

```typescript
// Main processing components
FFmpegProcessor    // Audio manipulation and processing
AudioAnalyzer      // Metadata extraction and validation
TempFileManager    // Temporary file lifecycle management
QueueManager       // Job queue orchestration
```

### AudioJob Contract

The `AudioJob` interface defines the complete specification for audio rendering:

```typescript
interface AudioJob {
  // Input sources
  voiceUrl?: string;        // TTS or uploaded voice
  musicUrl?: string;        // Background music

  // Timing configuration
  durationMin: number;      // 5, 10, or 15 minutes
  pauseSec: number;         // Pause between loops (1-30s)
  loopMode: "repeat" | "interval";
  intervalSec?: number;     // For interval mode (30-300s)

  // Audio layers gain control (dB)
  gains: {
    voiceDb: number;        // -30 to +10 dB (default: -1)
    musicDb: number;        // -30 to +10 dB (default: -10)
    solfeggioDb: number;    // -30 to +10 dB (default: -16)
    binauralDb: number;     // -30 to +10 dB (default: -18)
  };

  // Fade effects
  fade: {
    inMs: number;           // Fade in duration (0-5000ms)
    outMs: number;          // Fade out duration (0-5000ms)
  };

  // Output configuration
  channels: 2;              // ALWAYS stereo (mandatory)
  outputFormat: "mp3" | "wav";

  // Optional tone generators
  solfeggio?: {
    enabled: boolean;
    hz: 174 | 285 | 396 | 417 | 528 | 639 | 741 | 852 | 963;
    wave: "sine" | "triangle" | "square";
  };

  binaural?: {
    enabled: boolean;
    band: "delta" | "theta" | "alpha" | "beta" | "gamma";
    beatHz: number;         // 0.1 to 100 Hz
    carrierHz: number;      // 50 to 1000 Hz
  };

  // Safety features
  safety: {
    limiter: boolean;       // Enable loudness limiting
    targetLufs: number;     // Target loudness (-30 to -6)
  };
}
```

## FFmpegProcessor API

### Core Methods

#### normalizeLoudness
Normalizes audio to target LUFS with stereo enforcement.

```typescript
async normalizeLoudness(
  inputPath: string,
  outputPath: string,
  targetLufs?: number // default: -16
): Promise<Result<{ outputPath: string; targetLufs: number }>>
```

#### convertFormat
Converts audio format while maintaining stereo.

```typescript
async convertFormat(
  inputPath: string,
  outputPath: string,
  format: "mp3" | "wav",
  options?: ConvertOptions
): Promise<Result<{ outputPath: string; format: string }>>
```

#### mixAudioTracks
Mixes multiple audio inputs with individual gain control.

```typescript
async mixAudioTracks(
  inputs: MixInput[],
  outputPath: string
): Promise<Result<{ outputPath: string; inputCount: number }>>

interface MixInput {
  path: string;
  gainDb: number;
}
```

#### generateTone
Generates pure tones for Solfeggio frequencies.

```typescript
async generateTone(options: {
  frequency: number;
  durationSec: number;
  outputPath: string;
  waveform: "sine" | "triangle" | "square";
  gainDb?: number;
}): Promise<Result<{ outputPath: string; frequency: number; duration: number }>>
```

#### generateBinauralBeat
Creates binaural beats with separate left/right frequencies.

```typescript
async generateBinauralBeat(options: {
  carrierHz: number;
  beatHz: number;
  durationSec: number;
  outputPath: string;
  gainDb?: number;
}): Promise<Result<{ outputPath: string; leftFreq: number; rightFreq: number }>>
```

#### processAudioJob
Processes a complete AudioJob with all layers.

```typescript
async processAudioJob(
  job: AudioJob,
  outputPath: string
): Promise<Result<{ outputPath: string; format: string; channels: number }>>
```

## AudioAnalyzer API

### Analysis Methods

#### analyze
Comprehensive audio file analysis.

```typescript
async analyze(audioPath: string): Promise<Result<AudioAnalysis>>

interface AudioAnalysis {
  durationMs: number;
  channels: number;
  sampleRate: number;
  bitrate?: number;
  format: string;
  isStereo: boolean;
  peakLevel?: number;
  rmsLevel?: number;
  lufs?: number;
}
```

#### validateStereo
Validates stereo compliance.

```typescript
async validateStereo(audioPath: string): Promise<Result<StereoValidation>>

interface StereoValidation {
  isValid: boolean;
  channels: number;
  reason?: string;
}
```

## TempFileManager API

### File Management

#### createTempDir
Creates a unique temporary directory.

```typescript
async createTempDir(suffix?: string): Promise<Result<string>>
```

#### createTempFile
Creates a temporary file with content.

```typescript
async createTempFile(
  filename: string,
  content: string | Buffer,
  subdir?: string
): Promise<Result<string>>
```

#### cleanup
Removes all tracked temporary files.

```typescript
async cleanup(): Promise<Result<CleanupStats>>

interface CleanupStats {
  removed: number;
  failed: number;
  errors?: Error[];
}
```

## Error Handling

All methods use the Result pattern for functional error handling:

```typescript
type Result<T, E = Error> = 
  | { isOk: true; value: T }
  | { isOk: false; error: E };

// Usage example
const result = await processor.normalizeLoudness(input, output);
if (result.isOk) {
  console.log("Success:", result.value);
} else {
  console.error("Error:", result.error.message);
}
```

## Usage Examples

### Basic Audio Processing

```typescript
import { FFmpegProcessor, AudioAnalyzer } from "@mindscript/audio-engine";

const processor = new FFmpegProcessor();
const analyzer = new AudioAnalyzer();

// Normalize audio loudness
const normalized = await processor.normalizeLoudness(
  "/input/voice.mp3",
  "/output/voice-normalized.mp3",
  -16 // Target LUFS
);

// Validate stereo compliance
const validation = await analyzer.validateStereo("/output/voice-normalized.mp3");
if (!validation.value.isValid) {
  throw new Error(validation.value.reason);
}
```

### Complex Audio Job

```typescript
const audioJob: AudioJob = {
  voiceUrl: "https://storage.example.com/voice.mp3",
  musicUrl: "https://storage.example.com/ambient.mp3",
  durationMin: 10,
  pauseSec: 3,
  loopMode: "repeat",
  gains: {
    voiceDb: -1,
    musicDb: -10,
    solfeggioDb: -16,
    binauralDb: -18,
  },
  fade: {
    inMs: 1000,
    outMs: 1500,
  },
  channels: 2, // Mandatory stereo
  outputFormat: "mp3",
  solfeggio: {
    enabled: true,
    hz: 528, // Love frequency
    wave: "sine",
  },
  binaural: {
    enabled: true,
    band: "alpha",
    beatHz: 10,
    carrierHz: 200,
  },
  safety: {
    limiter: true,
    targetLufs: -16,
  },
};

const result = await processor.processAudioJob(audioJob, "/output/final.mp3");
```

### Mixing Multiple Tracks

```typescript
const inputs = [
  { path: "/tmp/voice.mp3", gainDb: -1 },
  { path: "/tmp/music.mp3", gainDb: -10 },
  { path: "/tmp/solfeggio.mp3", gainDb: -16 },
];

const mixed = await processor.mixAudioTracks(inputs, "/output/mixed.mp3");
```

## Performance Optimization

### Caching Strategy

- TTS outputs are cached by content hash (text + voice settings)
- Frequently used background music segments are pre-loaded
- Silence assets are pre-generated and reused
- Analysis results are cached with configurable TTL

### Stream Processing

For large files, use streaming to minimize memory usage:

```typescript
const inputStream = fs.createReadStream("/large/input.wav");
const outputStream = fs.createWriteStream("/output/processed.mp3");

await processor.processStream(inputStream, outputStream, {
  format: "mp3",
  enforeStereo: true,
});
```

### Parallel Processing

The engine supports concurrent job processing through the QueueManager:

```typescript
const queue = new QueueManager(supabaseClient);

// Enqueue multiple jobs
await queue.enqueueAudioJob(job1);
await queue.enqueueAudioJob(job2);
await queue.enqueueAudioJob(job3);

// Worker processes jobs in parallel
```

## Testing

### Unit Tests

```bash
npm test
```

### Coverage Report

```bash
npm run test:coverage
```

### Integration Tests

Integration tests verify the complete audio pipeline:

```typescript
describe("Audio Engine Integration", () => {
  it("should enforce stereo output on all operations", async () => {
    // Test implementation
  });
});
```

## Best Practices

1. **Always validate stereo compliance** after any audio operation
2. **Use Result pattern** for all async operations
3. **Clean up temp files** using TempFileManager
4. **Cache TTS outputs** to minimize API calls
5. **Monitor LUFS levels** to ensure consistent loudness
6. **Test with various input formats** (mono, stereo, surround)
7. **Handle network failures** with retry logic
8. **Log all operations** for debugging
9. **Use streaming** for files over 50MB
10. **Validate gains** to prevent clipping

## Troubleshooting

### Common Issues

#### Mono Audio Rejection
- **Problem**: Input audio is mono
- **Solution**: Audio is automatically converted to stereo by the processor

#### Loudness Inconsistency
- **Problem**: Output levels vary between files
- **Solution**: Enable limiter and set consistent targetLufs

#### Memory Issues with Large Files
- **Problem**: Out of memory errors
- **Solution**: Use stream processing instead of loading entire file

#### FFmpeg Not Found
- **Problem**: FFmpeg binary not in PATH
- **Solution**: Install FFmpeg or specify custom path in config

## Dependencies

- **fluent-ffmpeg**: FFmpeg Node.js wrapper
- **ffmpeg binary**: Must be installed separately
- **@mindscript/schemas**: Validation schemas
- **@supabase/supabase-js**: Queue persistence

## License

Proprietary - MindScript Platform
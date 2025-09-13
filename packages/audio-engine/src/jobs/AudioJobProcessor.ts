import type { AudioJobQueue } from "@mindscript/schemas";
import { Result, Ok, Err } from "../types";
import { ProgressTracker } from "./ProgressTracker";
import { TempFileManager } from "../utils/TempFileManager";
import { StorageUploader } from "../storage/StorageUploader";
import { OpenAIProvider } from "../providers/OpenAIProvider";
import { ElevenLabsProvider } from "../providers/ElevenLabsProvider";
import { SolfeggioGenerator } from "../generators/SolfeggioGenerator";
import { BinauralGenerator } from "../generators/BinauralGenerator";
import { AudioMixer } from "../processors/AudioMixer";
import { FFmpegProcessor } from "../processors/FFmpegProcessor";
import * as fs from "fs/promises";
import * as path from "path";
import fetch from "node-fetch";

interface ProcessorConfig {
  progressTracker?: ProgressTracker;
  tempFileManager?: TempFileManager;
  storageUploader?: StorageUploader;
  maxDurationMinutes?: number;
  targetLufs?: number;
  ttsChunkSize?: number;
  maxRetries?: number;
  supabaseUrl?: string;
  supabaseKey?: string;
  openaiApiKey?: string;
  elevenLabsApiKey?: string;
}

interface ProcessResult {
  outputUrl: string;
  metadata?: Record<string, any>;
}

interface AudioLayer {
  path: string;
  gainDb: number;
  type: "voice" | "music" | "solfeggio" | "binaural";
}

/**
 * Main orchestrator for processing audio jobs
 */
export class AudioJobProcessor {
  private progressTracker: ProgressTracker;
  private tempFileManager: TempFileManager;
  private storageUploader: StorageUploader;
  private openaiProvider?: OpenAIProvider;
  private elevenLabsProvider?: ElevenLabsProvider;
  private solfeggioGenerator: SolfeggioGenerator;
  private binauralGenerator: BinauralGenerator;
  private audioMixer: AudioMixer;
  private ffmpegProcessor: FFmpegProcessor;
  private maxDurationMinutes: number;
  private targetLufs: number;
  private ttsChunkSize: number;
  private maxRetries: number;
  private cancelled: boolean = false;

  constructor(config: ProcessorConfig) {
    this.progressTracker = config.progressTracker || new ProgressTracker("default");
    this.tempFileManager = config.tempFileManager || new TempFileManager();
    
    // Initialize storage uploader
    this.storageUploader = config.storageUploader || new StorageUploader({
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL!,
      supabaseKey: config.supabaseKey || process.env.SUPABASE_SERVICE_KEY!,
      publicBucket: "public-audio",
      privateBucket: "private-audio",
    });

    // Initialize TTS providers if configured
    if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
      this.openaiProvider = new OpenAIProvider({
        apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY!,
      });
    }

    if (config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY) {
      this.elevenLabsProvider = new ElevenLabsProvider({
        apiKey: config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY!,
      });
    }

    // Initialize generators and processors
    this.solfeggioGenerator = new SolfeggioGenerator();
    this.binauralGenerator = new BinauralGenerator();
    this.audioMixer = new AudioMixer();
    this.ffmpegProcessor = new FFmpegProcessor();

    // Configuration
    this.maxDurationMinutes = config.maxDurationMinutes ?? 15;
    this.targetLufs = config.targetLufs ?? -16;
    this.ttsChunkSize = config.ttsChunkSize ?? 4500; // Leave room for safety
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * Process a complete audio job
   */
  async processJob(job: AudioJobQueue): Promise<Result<ProcessResult>> {
    const startTime = Date.now();
    this.cancelled = false;
    
    try {
      // Initialize progress tracking
      await this.progressTracker.reset();
      await this.progressTracker.startStage("INITIALIZING");

      // Validate job constraints
      const validationResult = this.validateJob(job);
      if (!validationResult.isOk) {
        return validationResult;
      }

      // Create temp directory for this job
      const tempDirResult = await this.tempFileManager.createTempDir(`job-${job.id}`);
      if (!tempDirResult.isOk) {
        return Err(new Error(`Failed to create temp directory: ${tempDirResult.error}`));
      }
      const tempDir = tempDirResult.value;

      await this.progressTracker.completeStage();

      // Download assets (background music if needed)
      await this.progressTracker.startStage("DOWNLOADING_ASSETS");
      const layers: AudioLayer[] = [];
      
      if (job.payload.projectData.layers.background?.enabled && 
          job.payload.projectData.layers.background.trackUrl) {
        const musicResult = await this.downloadBackgroundMusic(
          job.payload.projectData.layers.background.trackUrl,
          tempDir
        );
        if (musicResult.isOk) {
          layers.push({
            path: musicResult.value,
            gainDb: job.payload.projectData.layers.gains.bgDb,
            type: "music",
          });
        }
        // Continue without music if download fails
      }
      await this.progressTracker.completeStage();

      // Generate voice/TTS
      await this.progressTracker.startStage("GENERATING_VOICE");
      const voiceResult = await this.generateVoice(job, tempDir);
      if (!voiceResult.isOk) {
        return Err(new Error(`Voice generation failed: ${voiceResult.error}`));
      }
      layers.push({
        path: voiceResult.value,
        gainDb: job.payload.projectData.layers.gains.voiceDb,
        type: "voice",
      });
      await this.progressTracker.completeStage();

      // Generate tones (Solfeggio/Binaural)
      await this.progressTracker.startStage("GENERATING_TONES");
      
      if (job.payload.projectData.layers.solfeggio?.enabled) {
        const solfeggioResult = await this.generateSolfeggio(job, tempDir);
        if (solfeggioResult.isOk) {
          layers.push({
            path: solfeggioResult.value,
            gainDb: job.payload.projectData.layers.gains.solfeggioDb ?? -16,
            type: "solfeggio",
          });
        }
      }

      if (job.payload.projectData.layers.binaural?.enabled) {
        const binauralResult = await this.generateBinaural(job, tempDir);
        if (binauralResult.isOk) {
          layers.push({
            path: binauralResult.value,
            gainDb: job.payload.projectData.layers.gains.binauralDb ?? -18,
            type: "binaural",
          });
        }
      }
      await this.progressTracker.completeStage();

      // Mix audio layers
      await this.progressTracker.startStage("MIXING_AUDIO");
      const mixedPath = path.join(tempDir, "mixed.wav");
      const mixResult = await this.mixAudioLayers(layers, mixedPath, job);
      if (!mixResult.isOk) {
        return Err(new Error(`Audio mixing failed: ${mixResult.error}`));
      }
      await this.progressTracker.completeStage();

      // Normalize audio
      await this.progressTracker.startStage("NORMALIZING");
      const normalizedPath = path.join(tempDir, "normalized.wav");
      const normalizeResult = await this.normalizeAudio(mixedPath, normalizedPath);
      if (!normalizeResult.isOk) {
        return Err(new Error(`Audio normalization failed: ${normalizeResult.error}`));
      }
      await this.progressTracker.completeStage();

      // Convert to final format and upload
      await this.progressTracker.startStage("UPLOADING");
      const outputFormat = job.payload.outputOptions.format || "mp3";
      const finalPath = path.join(tempDir, `output.${outputFormat}`);
      
      const convertResult = await this.convertToFormat(normalizedPath, finalPath, outputFormat);
      if (!convertResult.isOk) {
        return Err(new Error(`Format conversion failed: ${convertResult.error}`));
      }

      // Upload to storage
      const uploadResult = await this.uploadToStorage(
        finalPath,
        job,
        outputFormat
      );
      if (!uploadResult.isOk) {
        return Err(new Error(`Upload failed: ${uploadResult.error}`));
      }
      
      await this.progressTracker.completeStage();

      // Generate metadata
      const metadata = await this.generateMetadata(
        finalPath,
        job,
        layers,
        Date.now() - startTime
      );

      // Clean up temp files
      await this.tempFileManager.cleanup();

      return Ok({
        outputUrl: uploadResult.value,
        metadata,
      });
    } catch (error) {
      // Ensure cleanup happens even on error
      await this.tempFileManager.cleanup();
      return Err(error as Error);
    }
  }

  /**
   * Validate job constraints
   */
  private validateJob(job: AudioJobQueue): Result<void> {
    // Check duration limit
    if (job.payload.projectData.durationMin > this.maxDurationMinutes) {
      return Err(new Error(
        `Job duration (${job.payload.projectData.durationMin} minutes) exceeds maximum (${this.maxDurationMinutes} minutes)`
      ));
    }

    // Check script length
    if (job.payload.projectData.scriptText.length > 5000) {
      // We'll handle this with chunking, but warn if way too long
      if (job.payload.projectData.scriptText.length > 50000) {
        return Err(new Error("Script text exceeds maximum length (50,000 characters)"));
      }
    }

    return Ok(undefined);
  }

  /**
   * Download background music
   */
  private async downloadBackgroundMusic(url: string, tempDir: string): Promise<Result<string>> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return Err(new Error(`Failed to download music: ${response.statusText}`));
      }

      const buffer = await response.buffer();
      const musicPath = path.join(tempDir, "background.mp3");
      await fs.writeFile(musicPath, buffer);

      // Ensure stereo
      const stereoPath = path.join(tempDir, "background-stereo.mp3");
      const stereoResult = await this.ffmpegProcessor.ensureStereo(musicPath, stereoPath);
      if (!stereoResult.isOk) {
        return stereoResult;
      }

      return Ok(stereoPath);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Generate voice audio (TTS or uploaded)
   */
  private async generateVoice(job: AudioJobQueue, tempDir: string): Promise<Result<string>> {
    const voiceLayer = job.payload.projectData.layers.voice;
    
    if (!voiceLayer.enabled) {
      return Err(new Error("Voice layer is not enabled"));
    }

    // Handle uploaded voice
    if (voiceLayer.provider === "uploaded" && voiceLayer.voiceUrl) {
      return this.downloadBackgroundMusic(voiceLayer.voiceUrl, tempDir);
    }

    // Handle TTS
    const text = job.payload.projectData.scriptText;
    const chunks = this.chunkText(text, this.ttsChunkSize);
    const audioBuffers: Buffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      await this.progressTracker.setCustomMessage(`Processing TTS chunk ${i + 1} of ${chunks.length}`);
      
      let result: Result<Buffer> | undefined;
      let retries = 0;
      
      while (retries < this.maxRetries) {
        try {
          if (voiceLayer.provider === "openai" && this.openaiProvider) {
            const ttsResult = await this.openaiProvider.synthesize({
              text: chunks[i],
              voice: voiceLayer.voiceCode || "nova",
              model: "tts-1-hd",
              format: "mp3",
            });
            
            if (ttsResult.isOk) {
              result = Ok(ttsResult.value.audioData);
              break;
            }
          } else if (voiceLayer.provider === "elevenlabs" && this.elevenLabsProvider) {
            const ttsResult = await this.elevenLabsProvider.synthesize({
              text: chunks[i],
              voice: voiceLayer.voiceCode || "",
              format: "mp3",
            });
            
            if (ttsResult.isOk) {
              result = Ok(ttsResult.value.audioData);
              break;
            }
          } else {
            return Err(new Error(`TTS provider ${voiceLayer.provider} not configured`));
          }
        } catch (error) {
          retries++;
          if (retries >= this.maxRetries) {
            return Err(error as Error);
          }
          await this.delay(1000 * retries); // Exponential backoff
        }
      }

      if (!result || !result.isOk) {
        return Err(new Error("Failed to generate TTS after retries"));
      }

      audioBuffers.push(result.value);
    }

    // Stitch chunks together
    await this.progressTracker.setCustomMessage("Stitching TTS chunks");
    const voicePath = path.join(tempDir, "voice.mp3");
    
    if (audioBuffers.length === 1) {
      await fs.writeFile(voicePath, audioBuffers[0]);
    } else {
      // Use FFmpeg to concatenate
      const chunkPaths: string[] = [];
      for (let i = 0; i < audioBuffers.length; i++) {
        const chunkPath = path.join(tempDir, `voice-chunk-${i}.mp3`);
        await fs.writeFile(chunkPath, audioBuffers[i]);
        chunkPaths.push(chunkPath);
      }
      
      const concatResult = await this.ffmpegProcessor.concatenateAudio(chunkPaths, voicePath);
      if (!concatResult.isOk) {
        return concatResult;
      }
    }

    // Ensure stereo
    const stereoPath = path.join(tempDir, "voice-stereo.mp3");
    const stereoResult = await this.ffmpegProcessor.ensureStereo(voicePath, stereoPath);
    if (!stereoResult.isOk) {
      return stereoResult;
    }

    await this.progressTracker.setCustomMessage(null);
    return Ok(stereoPath);
  }

  /**
   * Generate Solfeggio tone
   */
  private async generateSolfeggio(job: AudioJobQueue, tempDir: string): Promise<Result<string>> {
    const solfeggio = job.payload.projectData.layers.solfeggio;
    if (!solfeggio?.enabled || !solfeggio.hz) {
      return Err(new Error("Solfeggio not configured"));
    }

    const durationMs = job.payload.projectData.durationMin * 60 * 1000;
    const outputPath = path.join(tempDir, "solfeggio.wav");

    const result = await this.solfeggioGenerator.generate({
      frequency: solfeggio.hz,
      durationMs,
      outputPath,
      waveform: solfeggio.wave || "sine",
      fadeInMs: 1000,
      fadeOutMs: 1500,
    });

    if (!result.isOk) {
      return Err(new Error(`Solfeggio generation failed: ${result.error}`));
    }

    return Ok(result.value.outputPath);
  }

  /**
   * Generate Binaural beats
   */
  private async generateBinaural(job: AudioJobQueue, tempDir: string): Promise<Result<string>> {
    const binaural = job.payload.projectData.layers.binaural;
    if (!binaural?.enabled || !binaural.band) {
      return Err(new Error("Binaural not configured"));
    }

    const durationMs = job.payload.projectData.durationMin * 60 * 1000;
    const outputPath = path.join(tempDir, "binaural.wav");

    const result = await this.binauralGenerator.generate({
      band: binaural.band,
      beatFrequency: binaural.beatHz,
      carrierFrequency: binaural.carrierHz,
      durationMs,
      outputPath,
      fadeInMs: 1000,
      fadeOutMs: 1500,
    });

    if (!result.isOk) {
      return Err(new Error(`Binaural generation failed: ${result.error}`));
    }

    return Ok(result.value.outputPath);
  }

  /**
   * Mix audio layers together
   */
  private async mixAudioLayers(
    layers: AudioLayer[],
    outputPath: string,
    job: AudioJobQueue
  ): Promise<Result<string>> {
    const inputs = layers.map(layer => ({
      path: layer.path,
      gainDb: layer.gainDb,
    }));

    const result = await this.audioMixer.mix({
      inputs,
      outputPath,
      fadeInMs: 1000,
      fadeOutMs: 1500,
      normalizeToLufs: this.targetLufs,
    });

    if (!result.isOk) {
      return result;
    }

    return Ok(outputPath);
  }

  /**
   * Normalize audio to target LUFS
   */
  private async normalizeAudio(inputPath: string, outputPath: string): Promise<Result<string>> {
    const result = await this.ffmpegProcessor.normalizeLoudness(
      inputPath,
      outputPath,
      this.targetLufs
    );

    if (!result.isOk) {
      return result;
    }

    return Ok(outputPath);
  }

  /**
   * Convert audio to final format
   */
  private async convertToFormat(
    inputPath: string,
    outputPath: string,
    format: "mp3" | "wav"
  ): Promise<Result<string>> {
    if (format === "wav") {
      // Just copy if already WAV
      if (inputPath.endsWith(".wav")) {
        await fs.copyFile(inputPath, outputPath);
        return Ok(outputPath);
      }
    }

    const result = await this.ffmpegProcessor.convertFormat(inputPath, outputPath, {
      format,
      bitrate: format === "mp3" ? "192k" : undefined,
      sampleRate: 44100,
      channels: 2, // Always stereo
    });

    if (!result.isOk) {
      return result;
    }

    return Ok(outputPath);
  }

  /**
   * Upload final audio to storage
   */
  private async uploadToStorage(
    filePath: string,
    job: AudioJobQueue,
    format: string
  ): Promise<Result<string>> {
    const fileBuffer = await fs.readFile(filePath);
    const isPublic = job.payload.outputOptions.storageLocation === "public";
    const fileName = `${job.id}.${format}`;

    const result = await this.storageUploader.uploadFile({
      file: fileBuffer,
      fileName,
      isPublic,
      contentType: format === "mp3" ? "audio/mpeg" : "audio/wav",
      useOrganizedPath: true,
      useUniqueFileName: false,
    });

    if (!result.isOk) {
      return Err(new Error(`Upload failed: ${result.error}`));
    }

    return Ok(result.value.url);
  }

  /**
   * Generate job metadata
   */
  private async generateMetadata(
    filePath: string,
    job: AudioJobQueue,
    layers: AudioLayer[],
    processingTime: number
  ): Promise<Record<string, any>> {
    const stats = await fs.stat(filePath);
    
    // Get audio info using FFmpeg
    const infoResult = await this.ffmpegProcessor.getAudioInfo(filePath);
    const audioInfo = infoResult.isOk ? infoResult.value : {};

    return {
      jobId: job.id,
      duration: audioInfo.duration || 0,
      format: job.payload.outputOptions.format,
      sampleRate: audioInfo.sampleRate || 44100,
      bitrate: audioInfo.bitrate,
      channels: audioInfo.channels || 2,
      stereoVerified: audioInfo.channels === 2,
      lufs: this.targetLufs,
      fileSize: stats.size,
      layersUsed: layers.map(l => l.type),
      processingTime,
      fadeIn: 1000,
      fadeOut: 1500,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Chunk text for TTS processing
   */
  private chunkText(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        
        // If single sentence is too long, split by words
        if (sentence.length > maxLength) {
          const words = sentence.split(" ");
          let wordChunk = "";
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 > maxLength) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            } else {
              wordChunk += (wordChunk ? " " : "") + word;
            }
          }
          
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Cancel the current job processing
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.tempFileManager.cleanup();
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
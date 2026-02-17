/**
 * TTS Client Module
 * Handles text-to-speech synthesis using OpenAI and ElevenLabs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let OpenAI = null;
try {
  OpenAI = require('openai');
} catch {
  console.warn('OpenAI SDK not installed - TTS functionality limited');
}

/**
 * OpenAI voice mapping
 */
const OPENAI_VOICES = {
  alloy: { name: 'Alloy', gender: 'neutral' },
  echo: { name: 'Echo', gender: 'male' },
  fable: { name: 'Fable', gender: 'neutral', accent: 'british' },
  onyx: { name: 'Onyx', gender: 'male' },
  nova: { name: 'Nova', gender: 'female' },
  shimmer: { name: 'Shimmer', gender: 'female' },
};

/**
 * Synthesize speech using OpenAI TTS
 * @param {string} text - Text to synthesize
 * @param {object} options - Synthesis options
 * @param {string} options.voice - Voice ID (alloy, echo, fable, onyx, nova, shimmer)
 * @param {string} options.model - Model (tts-1 or tts-1-hd)
 * @param {number} options.speed - Speed (0.25 to 4.0)
 * @param {string} outputPath - Path to save the audio file
 */
async function synthesizeOpenAI(text, options, outputPath) {
  if (!OpenAI) {
    throw new Error('OpenAI SDK not installed');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const client = new OpenAI({ apiKey });

  const voice = options.voice || 'nova';
  const model = options.model || 'tts-1';
  const speed = options.speed || 0.9;

  // Validate voice
  if (!OPENAI_VOICES[voice]) {
    throw new Error(`Invalid OpenAI voice: ${voice}. Valid voices: ${Object.keys(OPENAI_VOICES).join(', ')}`);
  }

  console.log(`[TTS] Synthesizing with OpenAI: ${text.substring(0, 50)}...`);
  console.log(`[TTS] Voice: ${voice}, Model: ${model}, Speed: ${speed}`);

  const response = await client.audio.speech.create({
    model,
    voice,
    input: text,
    response_format: 'mp3',
    speed,
  });

  // Save to file
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  // Estimate duration based on text length and speed
  // Average speaking rate is ~150 words per minute
  const wordCount = text.split(/\s+/).length;
  const estimatedDurationMs = (wordCount / 150) * 60 * 1000 / speed;

  return {
    outputPath,
    durationMs: estimatedDurationMs,
    provider: 'openai',
    voice,
    model,
  };
}

/**
 * Synthesize speech using ElevenLabs TTS
 * @param {string} text - Text to synthesize
 * @param {object} options - Synthesis options
 * @param {string} options.voiceId - ElevenLabs voice ID
 * @param {string} options.modelId - Model ID (default: eleven_monolingual_v1)
 * @param {number} options.stability - Voice stability (0-1)
 * @param {number} options.similarity - Voice similarity boost (0-1)
 * @param {string} outputPath - Path to save the audio file
 */
async function synthesizeElevenLabs(text, options, outputPath) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not set');
  }

  const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
  const modelId = options.modelId || 'eleven_multilingual_v2';
  const stability = options.stability || 0.5;
  const similarity = options.similarity || 0.75;

  console.log(`[TTS] Synthesizing with ElevenLabs: ${text.substring(0, 50)}...`);
  console.log(`[TTS] Voice ID: ${voiceId}, Model: ${modelId}`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarity,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  // Save to file
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  // Apply speed adjustment via ffmpeg atempo filter (ElevenLabs has no native speed param)
  const speed = options.speed || 0.9;
  if (speed !== 1.0) {
    console.log(`[TTS] Applying speed adjustment: ${speed}x via ffmpeg atempo`);
    const tempPath = outputPath + '.tmp.mp3';
    execSync(`ffmpeg -y -i "${outputPath}" -filter:a "atempo=${speed}" "${tempPath}"`, { stdio: 'pipe' });
    fs.renameSync(tempPath, outputPath);
  }

  // Estimate duration based on text length, adjusted for speed
  const wordCount = text.split(/\s+/).length;
  const estimatedDurationMs = (wordCount / 150) * 60 * 1000 / speed;

  return {
    outputPath,
    durationMs: estimatedDurationMs,
    provider: 'elevenlabs',
    voiceId,
    modelId,
  };
}

/**
 * Synthesize speech using the specified provider
 * @param {string} text - Text to synthesize
 * @param {object} options - Synthesis options
 * @param {string} options.provider - TTS provider (openai or elevenlabs)
 * @param {string} outputPath - Path to save the audio file
 */
async function synthesize(text, options, outputPath) {
  const provider = options.provider || 'openai';

  if (provider === 'openai') {
    return synthesizeOpenAI(text, options, outputPath);
  } else if (provider === 'elevenlabs') {
    return synthesizeElevenLabs(text, options, outputPath);
  } else {
    throw new Error(`Unknown TTS provider: ${provider}`);
  }
}

/**
 * Get available voices for a provider
 */
function getAvailableVoices(provider = 'openai') {
  if (provider === 'openai') {
    return Object.entries(OPENAI_VOICES).map(([id, info]) => ({
      id,
      ...info,
      provider: 'openai',
    }));
  }

  // ElevenLabs voices require API call - return common defaults
  return [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', provider: 'elevenlabs' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'female', provider: 'elevenlabs' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', provider: 'elevenlabs' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male', provider: 'elevenlabs' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'female', provider: 'elevenlabs' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', provider: 'elevenlabs' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'male', provider: 'elevenlabs' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', provider: 'elevenlabs' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', gender: 'male', provider: 'elevenlabs' },
  ];
}

module.exports = {
  synthesize,
  synthesizeOpenAI,
  synthesizeElevenLabs,
  getAvailableVoices,
  OPENAI_VOICES,
};

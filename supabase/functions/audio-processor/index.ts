import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

// Types
interface AudioJob {
  id: string
  track_id: string
  user_id: string
  job_data: {
    script: string
    voice: {
      provider: 'openai' | 'elevenlabs' | 'uploaded'
      voice_id: string
      settings?: {
        speed?: number
        pitch?: number
        stability?: number
        similarity_boost?: number
      }
    }
    background_music?: {
      track_id: string
      volume: number // -60 to 0 dB
    }
    solfeggio?: {
      frequency: number // 174, 285, 396, 417, 528, 639, 741, 852, 963 Hz
      volume: number // -60 to 0 dB
    }
    binaural?: {
      base_frequency: number
      beat_frequency: number // Delta (0.5-4), Theta (4-8), Alpha (8-14), Beta (14-30), Gamma (30-100)
      volume: number // -60 to 0 dB
    }
    output: {
      format: 'mp3' | 'wav'
      quality: 'low' | 'medium' | 'high'
      normalize: boolean
      target_lufs?: number // Default -16
    }
  }
}

interface ProcessingStage {
  stage: string
  progress: number
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// OpenAI configuration
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

// ElevenLabs configuration
const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action } = await req.json()

    switch (action) {
      case 'process':
        return await processNextJob()
      case 'health':
        return new Response(JSON.stringify({ status: 'healthy' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('Error in audio-processor:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function processNextJob() {
  // Get next pending job using SKIP LOCKED pattern
  const { data: job, error: jobError } = await supabase
    .rpc('get_next_pending_job')
    .single()

  if (jobError || !job) {
    return new Response(
      JSON.stringify({ message: 'No pending jobs' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const audioJob: AudioJob = {
    id: job.job_id,
    track_id: job.track_id,
    user_id: job.user_id,
    job_data: job.job_data,
  }

  try {
    // Process the audio job
    await processAudioJob(audioJob)

    return new Response(
      JSON.stringify({
        message: 'Job processed successfully',
        job_id: audioJob.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    // Mark job as failed
    await supabase.rpc('complete_job', {
      job_id: audioJob.id,
      job_error: error.message,
    })

    throw error
  }
}

async function processAudioJob(job: AudioJob) {
  const tempDir = `/tmp/${job.id}`
  await Deno.mkdir(tempDir, { recursive: true })

  try {
    // Stage 1: Generate TTS (30% of progress)
    await updateProgress(job.id, 10, 'Generating speech from text')
    const speechFile = await generateTTS(job, tempDir)
    await updateProgress(job.id, 30, 'Speech generation complete')

    // Stage 2: Process background music if needed (10% of progress)
    let backgroundFile: string | undefined
    if (job.job_data.background_music) {
      await updateProgress(job.id, 35, 'Processing background music')
      backgroundFile = await processBackgroundMusic(job, tempDir)
      await updateProgress(job.id, 40, 'Background music ready')
    }

    // Stage 3: Generate tones if needed (10% of progress)
    let solfeggioFile: string | undefined
    let binauralFile: string | undefined

    if (job.job_data.solfeggio) {
      await updateProgress(job.id, 45, 'Generating Solfeggio tones')
      solfeggioFile = await generateSolfeggioTone(job, tempDir)
    }

    if (job.job_data.binaural) {
      await updateProgress(job.id, 50, 'Generating binaural beats')
      binauralFile = await generateBinauralBeat(job, tempDir)
    }

    // Stage 4: Mix all audio layers (30% of progress)
    await updateProgress(job.id, 55, 'Mixing audio layers')
    const mixedFile = await mixAudioLayers(
      job,
      tempDir,
      speechFile,
      backgroundFile,
      solfeggioFile,
      binauralFile
    )
    await updateProgress(job.id, 85, 'Audio mixing complete')

    // Stage 5: Upload to storage (15% of progress)
    await updateProgress(job.id, 90, 'Uploading to storage')
    const fileUrl = await uploadToStorage(job, mixedFile)

    // Stage 6: Complete job (5% of progress)
    await updateProgress(job.id, 95, 'Finalizing')
    await completeJob(job.id, {
      url: fileUrl,
      duration: await getAudioDuration(mixedFile),
      size: (await Deno.stat(mixedFile)).size,
      format: job.job_data.output.format,
    })

    await updateProgress(job.id, 100, 'Complete')
  } finally {
    // Clean up temp files
    try {
      await Deno.remove(tempDir, { recursive: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function generateTTS(job: AudioJob, tempDir: string): Promise<string> {
  const outputFile = `${tempDir}/speech.mp3`

  if (job.job_data.voice.provider === 'openai') {
    await generateOpenAITTS(
      job.job_data.script,
      job.job_data.voice.voice_id,
      outputFile,
      job.job_data.voice.settings
    )
  } else if (job.job_data.voice.provider === 'elevenlabs' && elevenLabsApiKey) {
    await generateElevenLabsTTS(
      job.job_data.script,
      job.job_data.voice.voice_id,
      outputFile,
      job.job_data.voice.settings
    )
  } else if (job.job_data.voice.provider === 'uploaded') {
    // Handle uploaded voice (would need voice cloning implementation)
    throw new Error('Uploaded voice not yet implemented')
  } else {
    throw new Error(`Unsupported TTS provider: ${job.job_data.voice.provider}`)
  }

  // Ensure stereo output
  await ensureStereo(outputFile)

  return outputFile
}

async function generateOpenAITTS(
  text: string,
  voice: string,
  outputFile: string,
  settings?: any
) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      input: text,
      voice: voice,
      response_format: 'mp3',
      speed: settings?.speed || 1.0,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI TTS failed: ${response.statusText}`)
  }

  const audioData = await response.arrayBuffer()
  await Deno.writeFile(outputFile, new Uint8Array(audioData))
}

async function generateElevenLabsTTS(
  text: string,
  voiceId: string,
  outputFile: string,
  settings?: any
) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: settings?.stability || 0.5,
          similarity_boost: settings?.similarity_boost || 0.5,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.statusText}`)
  }

  const audioData = await response.arrayBuffer()
  await Deno.writeFile(outputFile, new Uint8Array(audioData))
}

async function processBackgroundMusic(
  job: AudioJob,
  tempDir: string
): Promise<string> {
  const { track_id, volume } = job.job_data.background_music!
  const outputFile = `${tempDir}/background.mp3`

  // Download background track from storage
  const { data, error } = await supabase.storage
    .from('background-music')
    .download(track_id)

  if (error) throw error

  const arrayBuffer = await data.arrayBuffer()
  const tempInput = `${tempDir}/background_input.mp3`
  await Deno.writeFile(tempInput, new Uint8Array(arrayBuffer))

  // Apply volume adjustment using FFmpeg
  await runFFmpeg([
    '-i', tempInput,
    '-af', `volume=${volume}dB`,
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    '-ac', '2', // Ensure stereo
    outputFile,
  ])

  return outputFile
}

async function generateSolfeggioTone(
  job: AudioJob,
  tempDir: string
): Promise<string> {
  const { frequency, volume } = job.job_data.solfeggio!
  const outputFile = `${tempDir}/solfeggio.mp3`
  const duration = await getScriptDuration(job.job_data.script)

  // Generate sine wave at specified frequency
  await runFFmpeg([
    '-f', 'lavfi',
    '-i', `sine=frequency=${frequency}:duration=${duration}`,
    '-af', `volume=${volume}dB`,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ac', '2', // Ensure stereo
    outputFile,
  ])

  return outputFile
}

async function generateBinauralBeat(
  job: AudioJob,
  tempDir: string
): Promise<string> {
  const { base_frequency, beat_frequency, volume } = job.job_data.binaural!
  const outputFile = `${tempDir}/binaural.mp3`
  const duration = await getScriptDuration(job.job_data.script)

  const leftFreq = base_frequency
  const rightFreq = base_frequency + beat_frequency

  // Generate binaural beats with different frequencies for L/R channels
  await runFFmpeg([
    '-f', 'lavfi',
    '-i', `sine=frequency=${leftFreq}:duration=${duration}`,
    '-f', 'lavfi',
    '-i', `sine=frequency=${rightFreq}:duration=${duration}`,
    '-filter_complex',
    `[0][1]amerge=inputs=2,volume=${volume}dB`,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ac', '2', // Ensure stereo
    outputFile,
  ])

  return outputFile
}

async function mixAudioLayers(
  job: AudioJob,
  tempDir: string,
  speechFile: string,
  backgroundFile?: string,
  solfeggioFile?: string,
  binauralFile?: string
): Promise<string> {
  const outputFile = `${tempDir}/mixed.${job.job_data.output.format}`

  // Build FFmpeg filter complex for mixing
  const inputs: string[] = ['-i', speechFile]
  const filterParts: string[] = []
  let inputCount = 1

  if (backgroundFile) {
    inputs.push('-i', backgroundFile)
    inputCount++
  }

  if (solfeggioFile) {
    inputs.push('-i', solfeggioFile)
    inputCount++
  }

  if (binauralFile) {
    inputs.push('-i', binauralFile)
    inputCount++
  }

  // Create mixing filter
  for (let i = 0; i < inputCount; i++) {
    filterParts.push(`[${i}:a]`)
  }

  const mixFilter = `${filterParts.join('')}amix=inputs=${inputCount}:duration=first:dropout_transition=2`

  // Add normalization if requested
  let audioFilter = mixFilter
  if (job.job_data.output.normalize) {
    const targetLufs = job.job_data.output.target_lufs || -16
    audioFilter = `${mixFilter},loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`
  }

  // Set quality parameters
  const qualityParams = getQualityParams(
    job.job_data.output.format,
    job.job_data.output.quality
  )

  await runFFmpeg([
    ...inputs,
    '-filter_complex', audioFilter,
    ...qualityParams,
    '-ac', '2', // Ensure stereo output
    outputFile,
  ])

  return outputFile
}

async function uploadToStorage(job: AudioJob, filePath: string): Promise<string> {
  const fileData = await Deno.readFile(filePath)
  const fileName = `${job.track_id}/rendered_${Date.now()}.${job.job_data.output.format}`

  const { data, error } = await supabase.storage
    .from('audio-renders')
    .upload(fileName, fileData, {
      contentType: job.job_data.output.format === 'mp3'
        ? 'audio/mpeg'
        : 'audio/wav',
      upsert: false,
    })

  if (error) throw error

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('audio-renders')
    .getPublicUrl(fileName)

  return publicUrl
}

// Helper functions
async function updateProgress(jobId: string, progress: number, stage: string) {
  await supabase.rpc('update_job_progress', {
    job_id: jobId,
    new_progress: progress,
    new_stage: stage,
  })
}

async function completeJob(jobId: string, result: any) {
  await supabase.rpc('complete_job', {
    job_id: jobId,
    job_result: result,
  })
}

async function ensureStereo(filePath: string) {
  const tempFile = `${filePath}.stereo.mp3`
  await runFFmpeg([
    '-i', filePath,
    '-ac', '2', // Force stereo
    '-c:a', 'copy',
    tempFile,
  ])
  await Deno.rename(tempFile, filePath)
}

async function getAudioDuration(filePath: string): Promise<number> {
  const process = new Deno.Command('ffprobe', {
    args: [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    stdout: 'piped',
  })

  const { stdout } = await process.output()
  const duration = parseFloat(new TextDecoder().decode(stdout))
  return duration
}

async function getScriptDuration(script: string): Promise<number> {
  // Estimate duration based on word count (150 words per minute average)
  const wordCount = script.split(/\s+/).length
  const minutes = wordCount / 150
  return Math.ceil(minutes * 60) // Return seconds
}

function getQualityParams(format: string, quality: string): string[] {
  if (format === 'mp3') {
    const bitrates = {
      low: '128k',
      medium: '192k',
      high: '320k',
    }
    return ['-c:a', 'libmp3lame', '-b:a', bitrates[quality]]
  } else if (format === 'wav') {
    return ['-c:a', 'pcm_s16le', '-ar', '44100']
  }
  return []
}

async function runFFmpeg(args: string[]): Promise<void> {
  const command = new Deno.Command('ffmpeg', {
    args: ['-y', ...args], // -y to overwrite output files
    stdout: 'piped',
    stderr: 'piped',
  })

  const { code, stderr } = await command.output()

  if (code !== 0) {
    const errorMessage = new TextDecoder().decode(stderr)
    throw new Error(`FFmpeg failed: ${errorMessage}`)
  }
}
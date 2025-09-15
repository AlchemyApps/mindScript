import { BaseProcessor } from "./base.ts"

interface AudioRenderPayload {
  trackId: string
  userId: string
  script: string
  voice: string
  voiceProvider: 'openai' | 'elevenlabs'
  backgroundMusic?: {
    trackId: string
    volume: number
  }
  solfeggio?: {
    frequency: number
    volume: number
  }
  binaural?: {
    baseFrequency: number
    beatFrequency: number
    volume: number
  }
  outputFormat: 'mp3' | 'wav'
  quality: 'low' | 'medium' | 'high'
}

/**
 * Audio processor that delegates to the existing audio-processor Edge Function
 */
export class AudioProcessor extends BaseProcessor {
  private audioProcessorUrl: string

  constructor(supabase: any) {
    super(supabase)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    this.audioProcessorUrl = `${supabaseUrl}/functions/v1/audio-processor`
  }

  async process(jobId: string, payload: AudioRenderPayload, metadata: any): Promise<any> {
    console.log(`Processing audio render job ${jobId}`)

    // Validate payload
    this.validatePayload(payload, ['trackId', 'userId', 'script', 'voice', 'voiceProvider'])

    await this.updateProgress(jobId, 5, 'Initializing audio render')

    try {
      // Migrate the job to audio_job_queue for the audio-processor function
      const audioJobId = await this.createAudioJob(payload)

      await this.updateProgress(jobId, 10, 'Audio job queued')

      // Call the audio processor function
      const result = await this.withCircuitBreaker(async () => {
        const response = await fetch(this.audioProcessorUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'process',
            jobId: audioJobId
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Audio processor failed: ${error}`)
        }

        return await response.json()
      })

      await this.updateProgress(jobId, 50, 'Audio processing in progress')

      // Poll for completion (with timeout)
      const audioResult = await this.pollAudioJobCompletion(audioJobId, jobId)

      await this.updateProgress(jobId, 90, 'Audio render complete')

      // Update track with render URL
      if (audioResult.url) {
        await this.updateTrackUrl(payload.trackId, audioResult.url)
      }

      // Queue email notification
      await this.queueCompletionEmail(payload.userId, payload.trackId, audioResult)

      await this.updateProgress(jobId, 100, 'Completed')

      return {
        success: true,
        audioJobId,
        url: audioResult.url,
        duration: audioResult.duration,
        size: audioResult.size,
        timestamp: new Date().toISOString(),
      }

    } catch (error) {
      console.error(`Audio render job ${jobId} failed:`, error)
      throw error
    }
  }

  private async createAudioJob(payload: AudioRenderPayload): Promise<string> {
    // Map generic queue payload to audio_job_queue format
    const audioJobData = {
      script: payload.script,
      voice: payload.voice,
      voiceProvider: payload.voiceProvider,
      backgroundMusic: payload.backgroundMusic,
      solfeggio: payload.solfeggio,
      binaural: payload.binaural,
      outputFormat: payload.outputFormat || 'mp3',
      quality: payload.quality || 'high',
    }

    const { data, error } = await this.supabase
      .from('audio_job_queue')
      .insert({
        track_id: payload.trackId,
        user_id: payload.userId,
        status: 'pending',
        job_data: audioJobData,
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create audio job: ${error.message}`)
    }

    return data.id
  }

  private async pollAudioJobCompletion(
    audioJobId: string,
    parentJobId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const { data, error } = await this.supabase
        .from('audio_job_queue')
        .select('status, progress, stage, result, error')
        .eq('id', audioJobId)
        .single()

      if (error) {
        throw new Error(`Failed to check audio job status: ${error.message}`)
      }

      // Update parent job progress based on audio job progress
      if (data.progress > 10) {
        const mappedProgress = 10 + Math.floor(data.progress * 0.8) // Map 0-100 to 10-90
        await this.updateProgress(parentJobId, mappedProgress, data.stage)
      }

      if (data.status === 'completed') {
        return data.result
      }

      if (data.status === 'failed') {
        throw new Error(`Audio render failed: ${data.error}`)
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('Audio render timeout: job did not complete within expected time')
  }

  private async updateTrackUrl(trackId: string, url: string): Promise<void> {
    const { error } = await this.supabase
      .from('tracks')
      .update({
        audio_url: url,
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackId)

    if (error) {
      console.error(`Failed to update track URL: ${error.message}`)
    }
  }

  private async queueCompletionEmail(userId: string, trackId: string, result: any): Promise<void> {
    try {
      // Get user and track details
      const { data: user } = await this.supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      const { data: track } = await this.supabase
        .from('tracks')
        .select('title, duration')
        .eq('id', trackId)
        .single()

      if (user && track) {
        // Queue email notification
        await this.supabase.rpc('enqueue_job', {
          p_type: 'email',
          p_payload: {
            to: user.email,
            subject: 'Your meditation track is ready!',
            template: 'trackComplete',
            templateData: {
              name: user.full_name,
              trackTitle: track.title,
              duration: `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`,
              voice: result.voice,
              backgroundMusic: result.backgroundMusic,
              downloadUrl: result.url,
            },
          },
          p_priority: 'normal',
          p_user_id: userId,
        })
      }
    } catch (error) {
      console.error('Failed to queue completion email:', error)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if audio processor function is accessible
      const response = await fetch(this.audioProcessorUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
      })

      return response.ok
    } catch (error) {
      console.error('Audio processor health check failed:', error)
      return false
    }
  }
}
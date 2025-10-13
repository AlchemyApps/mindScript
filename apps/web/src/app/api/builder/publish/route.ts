import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  ValidateTrackSchema, 
  PublishMetadataSchema, 
  PricingConfigSchema,
  AudioJobSchema,
  TrackStatusSchema 
} from '@mindscript/schemas';
import { z } from 'zod';

const PublishRequestSchema = z.object({
  metadata: PublishMetadataSchema,
  pricing: PricingConfigSchema,
  trackConfig: ValidateTrackSchema,
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = PublishRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { metadata, pricing, trackConfig } = validation.data;

    // Start a transaction
    // Create the track record first
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .insert({
        user_id: user.id,
        title: metadata.title,
        description: metadata.description || null,
        script: trackConfig.script,
        voice_config: trackConfig.voice_config,
        music_config: trackConfig.music_config || null,
        frequency_config: trackConfig.frequency_config || null,
        output_config: {
          format: trackConfig.output_config?.format || 'mp3',
          quality: trackConfig.output_config?.quality || 'standard',
          is_public: metadata.visibility === 'public',
        },
        status: 'draft', // Will be updated to 'published' after render
        is_public: metadata.visibility === 'public',
        tags: metadata.tags || [],
        price_cents: pricing.enableMarketplace ? Math.round((pricing.price || 0) * 100) : null,
        category: metadata.category,
      })
      .select()
      .single();

    if (trackError || !track) {
      console.error('Failed to create track:', trackError);
      return NextResponse.json(
        { error: 'Failed to create track' },
        { status: 500 }
      );
    }

    // If marketplace enabled, create marketplace listing
    if (pricing.enableMarketplace) {
      const { error: listingError } = await supabase
        .from('marketplace_listings')
        .insert({
          track_id: track.id,
          seller_id: user.id,
          price_cents: Math.round((pricing.price || 0) * 100),
          promotional_price_cents: pricing.promotional && pricing.promotionalPrice 
            ? Math.round(pricing.promotionalPrice * 100) 
            : null,
          is_promotional: pricing.promotional || false,
          status: 'pending', // Will be active after render
        });

      if (listingError) {
        console.error('Failed to create marketplace listing:', listingError);
        // Don't fail the whole operation, just log the error
      }
    }

    // Create the audio job for rendering
    const jobData = {
      script: trackConfig.script,
      voice: trackConfig.voice_config,
      background_music: trackConfig.music_config ? {
        track_id: trackConfig.music_config.track_id,
        volume: trackConfig.music_config.volume || -20,
      } : undefined,
      solfeggio: trackConfig.frequency_config?.solfeggio ? {
        frequency: trackConfig.frequency_config.solfeggio.frequency,
        volume: trackConfig.frequency_config.solfeggio.volume || -30,
      } : undefined,
      binaural: trackConfig.frequency_config?.binaural ? {
        base_frequency: trackConfig.frequency_config.binaural.base_frequency,
        beat_frequency: trackConfig.frequency_config.binaural.beat_frequency,
        volume: trackConfig.frequency_config.binaural.volume || -30,
      } : undefined,
      output: {
        format: trackConfig.output_config?.format || 'mp3',
        quality: trackConfig.output_config?.quality || 'medium',
        normalize: true,
        target_lufs: -16,
      },
    };

    // Submit to audio job queue
    const { data: job, error: jobError } = await supabase
      .from('audio_job_queue')
      .insert({
        track_id: track.id,
        user_id: user.id,
        status: 'pending',
        progress: 0,
        job_data: jobData,
        stage: 'Preparing render job',
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create audio job:', jobError);
      
      // Clean up the track if job creation failed
      await supabase
        .from('tracks')
        .delete()
        .eq('id', track.id);
      
      return NextResponse.json(
        { error: 'Failed to submit render job' },
        { status: 500 }
      );
    }

    // Update track with render job ID
    await supabase
      .from('tracks')
      .update({ render_job_id: job.id })
      .eq('id', track.id);

    // Trigger the edge function to process the job
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/audio-processor`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'process' }),
        }
      );

      if (!response.ok) {
        console.error('Failed to trigger audio processing:', await response.text());
        // Don't fail the request, the job will be picked up by the worker
      }
    } catch (error) {
      console.error('Failed to trigger edge function:', error);
      // Don't fail the request, the job will be picked up by the worker
    }

    return NextResponse.json({
      success: true,
      track_id: track.id,
      job_id: job.id,
      message: 'Track submitted for rendering',
      estimated_time: calculateEstimatedRenderTime(trackConfig.script.length),
    });

  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateEstimatedRenderTime(scriptLength: number): number {
  // Base time: 30 seconds
  let time = 30;
  
  // Add time based on script length (roughly 1 second per 100 characters)
  time += Math.ceil(scriptLength / 100);
  
  // Add buffer for audio processing
  time += 30;
  
  // Return in seconds
  return time;
}
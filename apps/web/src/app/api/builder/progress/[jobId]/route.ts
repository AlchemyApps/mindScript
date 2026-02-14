import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RenderProgressSchema } from '@mindscript/schemas';
import type { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    const { jobId } = params;

    // Fetch job status
    const { data: job, error: jobError } = await supabase
      .from('audio_job_queue')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user owns this job
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Map job status to render stage
    let stage: 'preparing' | 'tts' | 'mixing' | 'normalizing' | 'uploading' | 'completed';
    let message = '';
    let percentage = job.progress_percentage || 0;
    let estimatedTimeRemaining: number | undefined;

    switch (job.status) {
      case 'pending':
        stage = 'preparing';
        message = 'Preparing render job...';
        percentage = 5;
        estimatedTimeRemaining = 120; // 2 minutes estimated
        break;
        
      case 'processing':
        // Determine stage based on progress
        if (percentage < 20) {
          stage = 'preparing';
          message = 'Setting up audio pipeline...';
        } else if (percentage < 40) {
          stage = 'tts';
          message = 'Converting script to speech...';
          estimatedTimeRemaining = Math.max(60, 180 - (percentage * 3));
        } else if (percentage < 60) {
          stage = 'mixing';
          message = 'Mixing audio layers...';
          estimatedTimeRemaining = Math.max(30, 120 - (percentage * 2));
        } else if (percentage < 80) {
          stage = 'normalizing';
          message = 'Optimizing audio levels...';
          estimatedTimeRemaining = Math.max(15, 60 - percentage);
        } else {
          stage = 'uploading';
          message = 'Uploading to cloud storage...';
          estimatedTimeRemaining = Math.max(5, 30 - (percentage - 80));
        }
        break;
        
      case 'completed':
        stage = 'completed';
        message = 'Track successfully rendered!';
        percentage = 100;
        estimatedTimeRemaining = 0;
        break;
        
      case 'failed':
        return NextResponse.json({
          job_id: jobId,
          percentage: job.progress_percentage || 0,
          stage: job.current_stage || 'preparing',
          message: job.error_message || 'Render failed',
          error: job.error_message || 'An error occurred during rendering',
        });
        
      default:
        stage = 'preparing';
        message = 'Processing...';
    }

    // If job has specific stage info, use it
    if (job.current_stage) {
      stage = job.current_stage as typeof stage;
    }
    if (job.progress_message) {
      message = job.progress_message;
    }

    // Prepare response
    const progress: z.infer<typeof RenderProgressSchema> = {
      job_id: jobId,
      percentage,
      stage,
      message,
      estimated_time_remaining: estimatedTimeRemaining,
    };

    // If completed, also return the track URL
    if (stage === 'completed' && job.track_id) {
      const { data: track } = await supabase
        .from('tracks')
        .select('audio_url')
        .eq('id', job.track_id)
        .single();

      if (track?.audio_url) {
        return NextResponse.json({
          ...progress,
          track_url: track.audio_url,
        });
      }
    }

    return NextResponse.json(progress);

  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Cancel render job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    const { jobId } = params;

    // Check job ownership and status
    const { data: job, error: jobError } = await supabase
      .from('audio_job_queue')
      .select('status, user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (job.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel completed job' },
        { status: 400 }
      );
    }

    // Update job status to cancelled
    const { error: updateError } = await supabase
      .from('audio_job_queue')
      .update({ 
        status: 'cancelled',
        error_message: 'Cancelled by user',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to cancel job' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Render job cancelled',
    });

  } catch (error) {
    console.error('Cancel job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
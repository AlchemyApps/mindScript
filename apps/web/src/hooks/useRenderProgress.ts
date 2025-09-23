'use client';

import { useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { usePublishStore } from '@/store/publishStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface JobProgress {
  id: string;
  status: string;
  progress: number;
  stage: string | null;
  error: string | null;
  completed_at: string | null;
}

export function useRenderProgress() {
  const { jobId, updateRenderProgress, setRenderError } = usePublishStore();
  const supabase = createClientComponentClient();

  const mapStageToRenderStage = useCallback((stage: string | null, status: string) => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'preparing';

    if (!stage) return 'preparing';

    // Map backend stages to frontend stages
    const stageMap: Record<string, string> = {
      'Generating speech from text': 'tts',
      'Speech generation complete': 'tts',
      'Processing background music': 'mixing',
      'Background music ready': 'mixing',
      'Generating Solfeggio tones': 'mixing',
      'Generating binaural beats': 'mixing',
      'Mixing audio layers': 'mixing',
      'Audio mixing complete': 'normalizing',
      'Generating preview': 'normalizing',
      'Preview generated': 'uploading',
      'Uploading to storage': 'uploading',
      'Finalizing': 'uploading',
      'Complete': 'completed',
    };

    return stageMap[stage] || 'preparing';
  }, []);

  const calculateEstimatedTime = useCallback((progress: number) => {
    // Estimate based on average render time of 3 minutes
    const totalTime = 180; // seconds
    const elapsedTime = (progress / 100) * totalTime;
    const remainingTime = totalTime - elapsedTime;
    return Math.max(0, Math.round(remainingTime));
  }, []);

  useEffect(() => {
    if (!jobId) return;

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      // Subscribe to changes for this specific job
      channel = supabase
        .channel(`job_progress_${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'audio_job_queue',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const job = payload.new as JobProgress;

            // Update render progress in store
            updateRenderProgress({
              percentage: job.progress,
              stage: mapStageToRenderStage(job.stage, job.status) as any,
              message: job.stage || undefined,
              estimatedTimeRemaining: calculateEstimatedTime(job.progress),
            });

            // Handle error state
            if (job.status === 'failed' && job.error) {
              setRenderError(job.error);
            }

            // Handle completion
            if (job.status === 'completed') {
              updateRenderProgress({
                percentage: 100,
                stage: 'completed',
                message: 'Track ready!',
                estimatedTimeRemaining: 0,
              });
            }
          }
        )
        .subscribe();

      // Also fetch initial status in case we missed updates
      const { data, error } = await supabase
        .from('audio_job_queue')
        .select('*')
        .eq('id', jobId)
        .single();

      if (data && !error) {
        updateRenderProgress({
          percentage: data.progress,
          stage: mapStageToRenderStage(data.stage, data.status) as any,
          message: data.stage || undefined,
          estimatedTimeRemaining: calculateEstimatedTime(data.progress),
        });

        if (data.status === 'failed' && data.error) {
          setRenderError(data.error);
        }
      }
    };

    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [jobId, supabase, updateRenderProgress, setRenderError, mapStageToRenderStage, calculateEstimatedTime]);
}
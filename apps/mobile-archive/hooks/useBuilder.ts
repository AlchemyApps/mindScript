import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { recordingService } from '../services/recordingService';

interface TrackData {
  title: string;
  script: string;
  voice: string;
  recordedVoiceUrl?: string;
  backgroundMusic: string | null;
  frequencyType: 'solfeggio' | 'binaural' | 'none';
  frequencyValue: number;
  gain: number;
}

interface UseBuilderReturn {
  trackData: TrackData;
  updateTrackData: (updates: Partial<TrackData>) => void;
  submitTrack: () => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  validateStep: (stepId: string) => boolean;
  resetTrack: () => void;
}

const initialTrackData: TrackData = {
  title: '',
  script: '',
  voice: 'alloy',
  recordedVoiceUrl: undefined,
  backgroundMusic: null,
  frequencyType: 'none',
  frequencyValue: 0,
  gain: 0.5,
};

export function useBuilder(): UseBuilderReturn {
  const [trackData, setTrackData] = useState<TrackData>(initialTrackData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateTrackData = useCallback((updates: Partial<TrackData>) => {
    setTrackData(prev => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  const validateStep = useCallback((stepId: string): boolean => {
    switch (stepId) {
      case 'script':
        if (!trackData.title || trackData.title.trim().length === 0) {
          Alert.alert('Validation Error', 'Please provide a title for your track');
          return false;
        }
        if (!trackData.script || trackData.script.trim().length < 10) {
          Alert.alert('Validation Error', 'Please provide a script with at least 10 characters');
          return false;
        }
        return true;

      case 'voice':
        if (!trackData.voice && !trackData.recordedVoiceUrl) {
          Alert.alert('Validation Error', 'Please select a voice or record your own');
          return false;
        }
        return true;

      case 'music':
        // Music is optional, always valid
        return true;

      case 'frequency':
        // Frequency settings are optional, always valid
        return true;

      case 'preview':
        // Final validation
        return validateStep('script') && validateStep('voice');

      default:
        return true;
    }
  }, [trackData]);

  const submitTrack = useCallback(async () => {
    try {
      // Final validation
      if (!validateStep('preview')) {
        throw new Error('Please complete all required fields');
      }

      setIsSubmitting(true);
      setError(null);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to create tracks');
      }

      // Upload recorded voice if present
      let uploadedVoiceUrl = trackData.recordedVoiceUrl;
      if (uploadedVoiceUrl && uploadedVoiceUrl.startsWith('file://')) {
        try {
          uploadedVoiceUrl = await recordingService.uploadToSupabase(uploadedVoiceUrl, user.id);
        } catch (uploadError) {
          console.error('Failed to upload recording:', uploadError);
          throw new Error('Failed to upload voice recording');
        }
      }

      // Prepare track data for submission
      const submitData = {
        user_id: user.id,
        title: trackData.title.trim(),
        script: trackData.script.trim(),
        voice: trackData.voice === 'recorded' ? null : trackData.voice,
        custom_voice_url: uploadedVoiceUrl,
        background_music: trackData.backgroundMusic,
        frequency_type: trackData.frequencyType === 'none' ? null : trackData.frequencyType,
        frequency_value: trackData.frequencyType === 'none' ? null : trackData.frequencyValue,
        gain: trackData.frequencyType === 'none' ? null : trackData.gain,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      // Submit to database
      const { data, error: submitError } = await supabase
        .from('tracks')
        .insert(submitData)
        .select()
        .single();

      if (submitError) {
        throw submitError;
      }

      // Queue for rendering (would call an edge function or API endpoint)
      try {
        const { error: queueError } = await supabase.functions.invoke('queue-track-render', {
          body: { trackId: data.id },
        });

        if (queueError) {
          console.error('Failed to queue track for rendering:', queueError);
          // Don't throw here as the track is already created
        }
      } catch (queueErr) {
        console.error('Failed to queue track:', queueErr);
      }

      // Clean up local recorded file if it exists
      if (trackData.recordedVoiceUrl && trackData.recordedVoiceUrl.startsWith('file://')) {
        try {
          await recordingService.deleteLocalRecording(trackData.recordedVoiceUrl);
        } catch (cleanupError) {
          console.error('Failed to clean up local recording:', cleanupError);
        }
      }

      setIsSubmitting(false);
      return;
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Failed to submit track');
      throw err;
    }
  }, [trackData, validateStep]);

  const resetTrack = useCallback(() => {
    setTrackData(initialTrackData);
    setError(null);
    setIsSubmitting(false);

    // Cancel any ongoing submission
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    trackData,
    updateTrackData,
    submitTrack,
    isSubmitting,
    error,
    validateStep,
    resetTrack,
  };
}
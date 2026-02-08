'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Upload, Play, Pause, RotateCcw, AlertCircle, BookOpen, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const VOICE_CLONE_SCRIPT = `Take a deep breath and let your body relax. Feel the weight of the day begin to lift as you settle into this moment.

You are capable of extraordinary things. Every challenge you have faced has prepared you for what lies ahead. Trust in your journey, even when the path feels uncertain.

Today, I choose to be kind to myself. I release the need for perfection and embrace progress. Small steps forward are still steps forward, and I honor each one.

The world around me is full of beauty and possibility. I notice the warmth of sunlight, the gentle rhythm of my breath, and the quiet strength that lives within me.

I am worthy of love, rest, and joy. These are not rewards to be earned — they are gifts I give myself freely. My well-being matters, and I prioritize it without guilt.

When difficult thoughts arise, I acknowledge them without judgment. They are passing clouds in a vast sky. I am the sky — expansive, calm, and always present.

Each morning brings a fresh beginning. I greet it with curiosity and gratitude, knowing that today holds moments worth savoring. I am exactly where I need to be.`;



interface VoiceRecorderProps {
  onAudioReady: (file: File, duration: number) => void;
  onClear: () => void;
  hasAudio: boolean;
  className?: string;
}

type RecordingState = 'idle' | 'recording' | 'recorded' | 'uploaded';

export function VoiceRecorder({ onAudioReady, onClear, hasAudio, className }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>(hasAudio ? 'recorded' : 'idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recordingTimeRef = useRef(0);

  const MIN_DURATION = 60;
  const MAX_DURATION = 180;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.pause();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Pick the best supported mime type
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
        (t) => MediaRecorder.isTypeSupported(t)
      );

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000); // Collect chunks every second
      setState('recording');
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          recordingTimeRef.current = next;
          if (next >= MAX_DURATION) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
      } else {
        setError(`Could not start recording: ${msg}`);
      }
      console.error('[VoiceRecorder] Recording failed:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();

      // Process after stop — use recordingTime from timer since
      // Chrome's MediaRecorder WebM blobs report Infinity for duration
      const capturedTime = recordingTimeRef.current;
      setTimeout(() => {
        const recordedType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const ext = recordedType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: recordedType });
        const file = new File([blob], `voice-sample.${ext}`, { type: recordedType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setDuration(capturedTime);

        if (capturedTime < MIN_DURATION) {
          setError(`Recording too short. Please record at least ${MIN_DURATION} seconds (you recorded ${capturedTime}s).`);
        } else {
          onAudioReady(file, capturedTime);
        }

        setState('recorded');
      }, 100);
    }
  }, [onAudioReady]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload an MP3, WAV, or WebM audio file.');
      return;
    }

    // Validate size
    if (file.size > 10485760) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    if (file.size < 100000) {
      setError('File too small. Please upload a clear audio recording.');
      return;
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      const dur = Math.round(audio.duration);
      setDuration(dur);
      if (dur < MIN_DURATION) {
        setError(`Audio too short. Need at least ${MIN_DURATION} seconds (file is ${dur}s).`);
      } else if (dur > MAX_DURATION) {
        setError(`Audio too long. Maximum is ${MAX_DURATION} seconds (file is ${dur}s).`);
      } else {
        onAudioReady(file, dur);
        setState('uploaded');
      }
    });
  }, [onAudioReady]);

  const handlePlayback = useCallback(() => {
    if (!audioUrl) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play();
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
  }, [audioUrl, isPlaying]);

  const handleReset = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setState('idle');
    setRecordingTime(0);
    setDuration(0);
    setIsPlaying(false);
    setError(null);
    onClear();
  }, [audioUrl, onClear]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min((recordingTime / MIN_DURATION) * 100, 100);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Recording / Upload Area */}
      {state === 'idle' && (
        <div className="space-y-4">
          {/* Record button */}
          <button
            type="button"
            onClick={startRecording}
            className="w-full group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary/40 bg-white/60 hover:bg-primary/5 transition-all duration-300"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
              <Mic className="w-7 h-7 text-red-500" />
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold text-text block">Record Your Voice</span>
              <span className="text-xs text-muted mt-1 block">Speak clearly for 60-180 seconds</span>
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-primary/40 bg-white/60 hover:bg-primary/5 text-sm text-muted hover:text-text transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Audio File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/webm"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Recording in progress */}
      {state === 'recording' && (
        <div className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-red-50/50 border border-red-100">
          {/* Animated recording indicator */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
            </div>
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full border-2 border-red-300/40 animate-ping" />
          </div>

          {/* Timer */}
          <div className="text-center">
            <span className="text-3xl font-mono font-bold text-text tabular-nums">
              {formatTime(recordingTime)}
            </span>
            <span className="text-xs text-muted block mt-1">
              {recordingTime < MIN_DURATION
                ? `${MIN_DURATION - recordingTime}s more needed`
                : 'Ready to stop'
              }
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                recordingTime >= MIN_DURATION ? 'bg-accent' : 'bg-red-400'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stop button */}
          <button
            type="button"
            onClick={stopRecording}
            disabled={recordingTime < MIN_DURATION}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all',
              recordingTime >= MIN_DURATION
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            <Square className="w-4 h-4" />
            Stop Recording
          </button>
        </div>
      )}

      {/* Recorded / Uploaded playback */}
      {(state === 'recorded' || state === 'uploaded') && audioUrl && (
        <div className="p-5 rounded-2xl bg-white/80 border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-text block">
                {state === 'uploaded' ? 'Uploaded Audio' : 'Recorded Audio'}
              </span>
              <span className="text-xs text-muted">{formatTime(duration)} duration</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePlayback}
                className={cn(
                  'p-2.5 rounded-full transition-all',
                  isPlaying
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-muted hover:text-text hover:bg-gray-200'
                )}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="p-2.5 rounded-full bg-gray-100 text-muted hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Simple waveform visualization */}
          <div className="flex items-end justify-center h-12 gap-[3px]">
            {Array.from({ length: 40 }, (_, i) => {
              const h = 20 + Math.sin(i * 0.5 + duration) * 30 + Math.random() * 20;
              return (
                <div
                  key={i}
                  className={cn(
                    'w-1.5 rounded-full transition-all duration-300',
                    isPlaying ? 'bg-primary animate-pulse' : 'bg-gray-300'
                  )}
                  style={{
                    height: `${h}%`,
                    animationDelay: `${i * 30}ms`,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}

      {/* Reading script — shown in idle and recording states */}
      {(state === 'idle' || state === 'recording') && (
        <ReadingScriptPanel isRecording={state === 'recording'} />
      )}
    </div>
  );
}

function ReadingScriptPanel({ isRecording }: { isRecording: boolean }) {
  const [expanded, setExpanded] = useState(isRecording);

  // Auto-expand when recording starts
  useEffect(() => {
    if (isRecording) setExpanded(true);
  }, [isRecording]);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-colors',
      isRecording
        ? 'bg-white border-primary/20'
        : 'bg-soft-lavender/20 border-soft-lavender/30',
    )}>
      {/* Header — toggles expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className={cn('w-4 h-4', isRecording ? 'text-primary' : 'text-primary/70')} />
          <span className="text-xs font-semibold text-text">
            {isRecording ? 'Read this aloud' : 'Reading script for recording'}
          </span>
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-muted transition-transform duration-200',
          expanded && 'rotate-180',
        )} />
      </button>

      {/* Script content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted">
            Read the following at a natural pace. This script is designed to capture the full range of your voice.
          </p>
          <div className={cn(
            'p-4 rounded-lg text-sm leading-relaxed whitespace-pre-line',
            isRecording
              ? 'bg-primary/[0.03] border border-primary/10 text-text'
              : 'bg-white/60 text-text/80',
          )}>
            {VOICE_CLONE_SCRIPT}
          </div>

          {/* Condensed tips */}
          {!isRecording && (
            <div className="flex flex-wrap gap-2 pt-1">
              {['Quiet room', 'Natural pace', 'Consistent volume', 'Good mic helps'].map((tip) => (
                <span key={tip} className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/60 text-[10px] text-muted font-medium">
                  {tip}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

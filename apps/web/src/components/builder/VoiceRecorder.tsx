'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Upload, Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

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
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

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

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= MAX_DURATION) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access and try again.');
      console.error('MediaRecorder error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();

      // Process after stop
      setTimeout(() => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice-sample.webm', { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Get actual duration
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => {
          const dur = Math.round(audio.duration);
          setDuration(dur);
          if (dur < MIN_DURATION) {
            setError(`Recording too short. Please record at least ${MIN_DURATION} seconds (you recorded ${dur}s).`);
          } else {
            onAudioReady(file, dur);
          }
        });

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

      {/* Recording tips */}
      {state === 'idle' && (
        <div className="p-4 rounded-xl bg-soft-lavender/20 border border-soft-lavender/30">
          <span className="text-xs font-semibold text-text block mb-2">Tips for best results</span>
          <ul className="text-xs text-muted space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">&#8226;</span>
              Record in a quiet room with minimal background noise
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">&#8226;</span>
              Speak naturally at a consistent volume
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">&#8226;</span>
              Read varied content — try reading a book passage or article
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">&#8226;</span>
              Use a good microphone if available (headset or USB mic)
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

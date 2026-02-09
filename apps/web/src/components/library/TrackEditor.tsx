'use client';

import { useState, useCallback } from 'react';
import {
  AudioLines,
  Music,
  Waves,
  Headphones,
  Timer,
  Repeat,
  Loader2,
  Sparkles,
  Gauge,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { VolumeSlider } from './VolumeSlider';

type BinauralBand = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

interface TrackConfig {
  voiceConfig: { provider: string; voice_id: string; settings?: { speed?: number } } | null;
  musicConfig: { id: string; name: string; url: string; volume_db: number } | null;
  frequencyConfig: {
    solfeggio?: { enabled: boolean; frequency?: number; hz?: number; volume_db?: number } | null;
    binaural?: { enabled: boolean; band?: BinauralBand; volume_db?: number } | null;
  } | null;
  outputConfig: {
    durationMin?: number;
    loop?: { enabled: boolean; pause_seconds: number };
  } | null;
}

interface EditEligibility {
  editCount: number;
  freeEditsRemaining: number;
  baseFee: number;
  totalFee: number;
}

interface TrackEditorProps {
  trackId: string;
  trackTitle: string;
  config: TrackConfig;
  startDelaySec?: number;
  eligibility: EditEligibility;
  onSubmit: (editData: EditPayload) => Promise<void>;
  className?: string;
}

export interface EditPayload {
  gains: {
    voiceDb: number;
    musicDb: number;
    solfeggioDb: number;
    binauralDb: number;
  };
  voiceSpeed?: number;
  startDelaySec?: number;
  solfeggio?: { enabled: boolean; frequency?: number };
  binaural?: { enabled: boolean; band?: BinauralBand };
  duration?: number;
  loop?: { enabled: boolean; pause_seconds: number };
}

const VOLUME_DEFAULTS = {
  voice: -1,
  music: -10,
  solfeggio: -18,
  binaural: -20,
} as const;

const DURATION_OPTIONS = [5, 10, 15] as const;

export function TrackEditor({
  trackId,
  trackTitle,
  config,
  startDelaySec: initialStartDelay = 3,
  eligibility,
  onSubmit,
  className,
}: TrackEditorProps) {
  // Voice speed state
  const [voiceSpeed, setVoiceSpeed] = useState(config.voiceConfig?.settings?.speed ?? 1.0);

  // Volume state
  const [voiceDb, setVoiceDb] = useState<number>(VOLUME_DEFAULTS.voice);
  const [musicDb, setMusicDb] = useState<number>(config.musicConfig?.volume_db ?? VOLUME_DEFAULTS.music);
  const [solfeggioDb, setSolfeggioDb] = useState<number>(
    config.frequencyConfig?.solfeggio?.volume_db ?? VOLUME_DEFAULTS.solfeggio
  );
  const [binauralDb, setBinauralDb] = useState<number>(
    config.frequencyConfig?.binaural?.volume_db ?? VOLUME_DEFAULTS.binaural
  );

  // Feature toggles
  const [solfeggioEnabled, setSolfeggioEnabled] = useState(
    config.frequencyConfig?.solfeggio?.enabled ?? false
  );
  const [binauralEnabled, setBinauralEnabled] = useState(
    config.frequencyConfig?.binaural?.enabled ?? false
  );

  // Duration, loop, and start delay
  const [duration, setDuration] = useState(config.outputConfig?.durationMin ?? 10);
  const [loopEnabled, setLoopEnabled] = useState(config.outputConfig?.loop?.enabled ?? true);
  const [pauseSeconds, setPauseSeconds] = useState(config.outputConfig?.loop?.pause_seconds ?? 5);
  const [startDelay, setStartDelay] = useState(initialStartDelay);

  // Max delay depends on duration: 5min → 120s, 10/15min → 300s
  const maxDelay = duration <= 5 ? 120 : 300;

  const [submitting, setSubmitting] = useState(false);

  const hasMusic = !!config.musicConfig;
  const hasSolfeggio = !!config.frequencyConfig?.solfeggio;
  const hasBinaural = !!config.frequencyConfig?.binaural;

  const isFreeEdit = eligibility.freeEditsRemaining > 0;
  const totalFeeCents = isFreeEdit ? 0 : eligibility.baseFee;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        gains: {
          voiceDb,
          musicDb,
          solfeggioDb,
          binauralDb,
        },
        voiceSpeed,
        startDelaySec: startDelay,
        solfeggio: hasSolfeggio ? { enabled: solfeggioEnabled, frequency: config.frequencyConfig?.solfeggio?.frequency ?? config.frequencyConfig?.solfeggio?.hz } : undefined,
        binaural: hasBinaural ? { enabled: binauralEnabled, band: config.frequencyConfig?.binaural?.band } : undefined,
        duration,
        loop: { enabled: loopEnabled, pause_seconds: pauseSeconds },
      });
    } finally {
      setSubmitting(false);
    }
  }, [voiceDb, musicDb, solfeggioDb, binauralDb, voiceSpeed, solfeggioEnabled, binauralEnabled, duration, loopEnabled, pauseSeconds, hasSolfeggio, hasBinaural, config, onSubmit]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold font-heading text-text">Edit Track</h2>
        <p className="text-sm text-muted mt-1 truncate">{trackTitle}</p>
      </div>

      {/* Edit count badge */}
      <div className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
        isFreeEdit
          ? 'bg-accent/10 text-accent'
          : 'bg-energy-glow/40 text-warm-gold'
      )}>
        <Sparkles className="w-3 h-3" />
        {isFreeEdit
          ? `Edit ${eligibility.editCount + 1} of ${eligibility.editCount + eligibility.freeEditsRemaining} free`
          : `$${(totalFeeCents / 100).toFixed(2)} per edit`
        }
      </div>

      {/* Volume Controls Section */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text mb-4">Volume Levels</h3>

        <div className="space-y-5 p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-gray-100">
          {/* Voice Volume — always present */}
          <VolumeSlider
            label="Voice"
            icon={<AudioLines className="w-4 h-4" />}
            value={voiceDb}
            min={-12}
            max={3}
            defaultValue={VOLUME_DEFAULTS.voice}
            onChange={setVoiceDb}
            color="from-primary to-primary-light"
          />

          {/* Music Volume — only if track has music */}
          {hasMusic && (
            <VolumeSlider
              label="Music"
              icon={<Music className="w-4 h-4" />}
              value={musicDb}
              min={-24}
              max={0}
              defaultValue={VOLUME_DEFAULTS.music}
              onChange={setMusicDb}
              color="from-emerald-500 to-teal-400"
            />
          )}

          {/* Solfeggio Volume — toggle + slider */}
          {hasSolfeggio && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Waves className="w-4 h-4 text-muted/60" />
                  <span className="text-sm font-medium text-text">Solfeggio</span>
                  <span className="text-[10px] text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                    {config.frequencyConfig?.solfeggio?.frequency ?? config.frequencyConfig?.solfeggio?.hz ?? 528} Hz
                  </span>
                </div>
                <ToggleSwitch enabled={solfeggioEnabled} onToggle={() => setSolfeggioEnabled(!solfeggioEnabled)} />
              </div>
              {solfeggioEnabled && (
                <VolumeSlider
                  label=""
                  value={solfeggioDb}
                  min={-30}
                  max={-6}
                  defaultValue={VOLUME_DEFAULTS.solfeggio}
                  onChange={setSolfeggioDb}
                  color="from-violet-500 to-purple-400"
                />
              )}
            </div>
          )}

          {/* Binaural Volume — toggle + slider */}
          {hasBinaural && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-muted/60" />
                  <span className="text-sm font-medium text-text">Binaural</span>
                  <span className="text-[10px] text-muted bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                    {config.frequencyConfig?.binaural?.band ?? 'alpha'}
                  </span>
                </div>
                <ToggleSwitch enabled={binauralEnabled} onToggle={() => setBinauralEnabled(!binauralEnabled)} />
              </div>
              {binauralEnabled && (
                <VolumeSlider
                  label=""
                  value={binauralDb}
                  min={-30}
                  max={-6}
                  defaultValue={VOLUME_DEFAULTS.binaural}
                  onChange={setBinauralDb}
                  color="from-cyan-500 to-blue-400"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Duration & Loop Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text">Playback Settings</h3>

        <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-gray-100 space-y-4">
          {/* Voice Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-muted/60" />
                <span className="text-sm font-medium text-text">Voice Speed</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[3.5rem] px-2 py-0.5',
                    'rounded-md text-xs font-mono font-semibold tabular-nums tracking-tight',
                    'bg-gray-100 text-text transition-colors duration-150',
                    voiceSpeed < 0.8 && 'bg-blue-50 text-blue-700',
                    voiceSpeed > 1.1 && 'bg-amber-50 text-amber-700',
                  )}
                >
                  {voiceSpeed.toFixed(2)}x
                </span>
                <button
                  type="button"
                  onClick={() => setVoiceSpeed(1.0)}
                  className={cn(
                    'p-1 rounded-md transition-all duration-200',
                    voiceSpeed === 1.0
                      ? 'text-transparent pointer-events-none'
                      : 'text-muted/50 hover:text-primary hover:bg-primary/5'
                  )}
                  aria-label="Reset speed to 1.0x"
                  tabIndex={voiceSpeed === 1.0 ? -1 : 0}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="relative h-8 flex items-center">
              <div className="absolute inset-x-0 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 via-primary to-amber-400 transition-all duration-100"
                  style={{ width: `${((voiceSpeed - 0.5) / 1.0) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                className="volume-slider-input absolute inset-x-0 w-full h-8 appearance-none bg-transparent cursor-pointer focus-visible:outline-none"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted/40">Slower</span>
              <span className="text-[10px] text-muted/40">Faster</span>
            </div>
          </div>

          {/* Duration selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted/60" />
              <span className="text-sm font-medium text-text">Duration</span>
            </div>
            <div className="flex gap-1.5 p-0.5 bg-gray-100 rounded-lg">
              {DURATION_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-all duration-200',
                    duration === mins
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-muted hover:text-text'
                  )}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Start Delay */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted/60" />
                <span className="text-sm font-medium text-text">Voice Start Delay</span>
              </div>
              <span className="text-xs font-mono text-muted tabular-nums">{startDelay}s</span>
            </div>
            <div className="relative h-8 flex items-center">
              <div className="absolute inset-x-0 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary transition-all duration-100"
                  style={{ width: `${(startDelay / maxDelay) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={maxDelay}
                step={1}
                value={startDelay}
                onChange={(e) => setStartDelay(Number(e.target.value))}
                className="volume-slider-input absolute inset-x-0 w-full h-8 appearance-none bg-transparent cursor-pointer focus-visible:outline-none"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted/40">No delay</span>
              <span className="text-[10px] text-muted/40">{maxDelay}s</span>
            </div>
            <p className="text-[11px] text-muted">
              Music plays from the start; your voice begins after this delay.
            </p>
          </div>

          {/* Loop toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-muted/60" />
              <span className="text-sm font-medium text-text">Loop</span>
            </div>
            <ToggleSwitch enabled={loopEnabled} onToggle={() => setLoopEnabled(!loopEnabled)} />
          </div>

          {/* Pause between loops */}
          {loopEnabled && (
            <div className="flex items-center justify-between pl-6 animate-scale-in">
              <span className="text-xs text-muted">Pause between loops</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={pauseSeconds}
                  onChange={(e) => setPauseSeconds(Math.max(1, Math.min(30, Number(e.target.value))))}
                  className="w-14 px-2 py-1 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <span className="text-xs text-muted">sec</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className={cn(
          'w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300',
          'bg-primary hover:bg-primary/90',
          submitting && 'opacity-70 cursor-not-allowed',
          !submitting && 'hover:shadow-lg hover:shadow-primary/20',
        )}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting edit...
          </span>
        ) : totalFeeCents > 0 ? (
          `Re-render Track — $${(totalFeeCents / 100).toFixed(2)}`
        ) : (
          'Re-render Track — Free'
        )}
      </button>
    </div>
  );
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors duration-300',
        enabled ? 'bg-primary' : 'bg-gray-200'
      )}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-sm',
          enabled && 'translate-x-4'
        )}
      />
    </button>
  );
}

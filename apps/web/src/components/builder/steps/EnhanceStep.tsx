'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Music, Waves, Headphones, Play, Pause, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type BinauralBand = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

interface SolfeggioFrequency {
  value: number;
  name: string;
  benefit: string;
  color: string;
  previewUrl: string;
}

interface BinauralOption {
  id: BinauralBand;
  name: string;
  frequency: string;
  benefit: string;
  color: string;
  previewUrl: string;
}

interface MusicOption {
  id: string;
  name: string;
  description: string;
  price: number;
  previewUrl?: string;
}

const SOLFEGGIO_FREQUENCIES: SolfeggioFrequency[] = [
  { value: 174, name: '174 Hz', benefit: 'Pain Relief', color: 'from-red-400 to-orange-400', previewUrl: '/audio-previews/solfeggio/solfeggio-174hz.mp3' },
  { value: 285, name: '285 Hz', benefit: 'Healing', color: 'from-orange-400 to-amber-400', previewUrl: '/audio-previews/solfeggio/solfeggio-285hz.mp3' },
  { value: 396, name: '396 Hz', benefit: 'Liberation', color: 'from-amber-400 to-yellow-400', previewUrl: '/audio-previews/solfeggio/solfeggio-396hz.mp3' },
  { value: 417, name: '417 Hz', benefit: 'Change', color: 'from-yellow-400 to-lime-400', previewUrl: '/audio-previews/solfeggio/solfeggio-417hz.mp3' },
  { value: 528, name: '528 Hz', benefit: 'Love & DNA Repair', color: 'from-emerald-400 to-teal-400', previewUrl: '/audio-previews/solfeggio/solfeggio-528hz.mp3' },
  { value: 639, name: '639 Hz', benefit: 'Connection', color: 'from-cyan-400 to-blue-400', previewUrl: '/audio-previews/solfeggio/solfeggio-639hz.mp3' },
  { value: 741, name: '741 Hz', benefit: 'Awakening', color: 'from-blue-400 to-indigo-400', previewUrl: '/audio-previews/solfeggio/solfeggio-741hz.mp3' },
  { value: 852, name: '852 Hz', benefit: 'Intuition', color: 'from-violet-400 to-purple-400', previewUrl: '/audio-previews/solfeggio/solfeggio-852hz.mp3' },
  { value: 963, name: '963 Hz', benefit: 'Divine', color: 'from-purple-400 to-pink-400', previewUrl: '/audio-previews/solfeggio/solfeggio-963hz.mp3' },
];

const BINAURAL_OPTIONS: BinauralOption[] = [
  { id: 'delta', name: 'Delta', frequency: '0.5–4 Hz', benefit: 'Deep Sleep', color: 'from-indigo-500 to-purple-600', previewUrl: '/audio-previews/binaural/binaural-delta.mp3' },
  { id: 'theta', name: 'Theta', frequency: '4–8 Hz', benefit: 'Meditation', color: 'from-purple-500 to-fuchsia-500', previewUrl: '/audio-previews/binaural/binaural-theta.mp3' },
  { id: 'alpha', name: 'Alpha', frequency: '8–13 Hz', benefit: 'Relaxation', color: 'from-blue-500 to-cyan-500', previewUrl: '/audio-previews/binaural/binaural-alpha.mp3' },
  { id: 'beta', name: 'Beta', frequency: '13–30 Hz', benefit: 'Focus', color: 'from-emerald-500 to-teal-500', previewUrl: '/audio-previews/binaural/binaural-beta.mp3' },
  { id: 'gamma', name: 'Gamma', frequency: '30–100 Hz', benefit: 'Peak Awareness', color: 'from-amber-500 to-orange-500', previewUrl: '/audio-previews/binaural/binaural-gamma.mp3' },
];

const MUSIC_OPTIONS: MusicOption[] = [
  { id: 'none', name: 'No Background Music', description: 'Voice only', price: 0 },
  { id: 'serene-spa-flow', name: 'Serene Spa Flow', description: 'Gentle ambient spa soundscape', price: 0.99, previewUrl: '/audio-previews/music/serene-spa-flow.mp3' },
  { id: 'tibetan-singing-bowls', name: 'Tibetan Singing Bowls', description: 'Resonant singing bowl soundscape', price: 0.99, previewUrl: '/audio-previews/music/tibetan-singing-bowls.mp3' },
];

interface EnhanceStepProps {
  solfeggio: { enabled: boolean; frequency: number; price: number } | undefined;
  binaural: { enabled: boolean; band: BinauralBand; price: number } | undefined;
  music: { id: string; name: string; price: number } | undefined;
  onSolfeggioChange: (solfeggio: { enabled: boolean; frequency: number; price: number } | undefined) => void;
  onBinauralChange: (binaural: { enabled: boolean; band: BinauralBand; price: number } | undefined) => void;
  onMusicChange: (music: { id: string; name: string; price: number } | undefined) => void;
  className?: string;
}

export function EnhanceStep({
  solfeggio,
  binaural,
  music,
  onSolfeggioChange,
  onBinauralChange,
  onMusicChange,
  className,
}: EnhanceStepProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Unified preview handler — stops any currently playing preview, then starts the new one
  const handlePreview = useCallback((id: string, url: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);

    audio.play().catch(() => {
      setPlayingId(null);
    });

    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
  }, [playingId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggleSolfeggio = () => {
    if (solfeggio?.enabled) {
      onSolfeggioChange({ ...solfeggio, enabled: false });
    } else {
      onSolfeggioChange({ enabled: true, frequency: 528, price: 0.99 });
    }
  };

  const handleToggleBinaural = () => {
    if (binaural?.enabled) {
      onBinauralChange({ ...binaural, enabled: false });
    } else {
      onBinauralChange({ enabled: true, band: 'alpha', price: 0.99 });
    }
  };

  return (
    <div className={cn('space-y-8', className)}>
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold font-heading text-text">
          Enhance your experience
        </h2>
        <p className="text-muted">
          Add healing frequencies and ambient sounds
        </p>
      </div>

      {/* ── Solfeggio Frequencies ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Solfeggio Frequencies</h3>
              <p className="text-sm text-muted">Ancient healing tones &middot; +$0.99</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={solfeggio?.enabled || false}
            onToggle={handleToggleSolfeggio}
          />
        </div>

        {solfeggio?.enabled && (
          <div className="grid grid-cols-3 gap-2.5 animate-scale-in">
            {SOLFEGGIO_FREQUENCIES.map((freq) => {
              const isSelected = solfeggio.frequency === freq.value;
              const isPlaying = playingId === `solfeggio-${freq.value}`;

              return (
                <div
                  key={freq.value}
                  className={cn(
                    'group relative rounded-xl border-2 transition-all duration-200 overflow-hidden',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  )}
                >
                  {/* Gradient accent bar */}
                  <div className={cn('h-1 w-full bg-gradient-to-r', freq.color)} />

                  <button
                    type="button"
                    onClick={() => onSolfeggioChange({ ...solfeggio, frequency: freq.value })}
                    className="w-full p-3 pt-2.5 text-center"
                  >
                    <div className={cn(
                      'text-sm font-bold transition-colors',
                      isSelected ? 'text-primary' : 'text-text'
                    )}>
                      {freq.name}
                    </div>
                    <div className="text-xs text-muted mt-0.5">{freq.benefit}</div>
                  </button>

                  {/* Preview button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(`solfeggio-${freq.value}`, freq.previewUrl);
                    }}
                    className={cn(
                      'absolute top-2.5 right-1.5 p-1.5 rounded-full transition-all duration-200',
                      isPlaying
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted/40 hover:text-muted hover:bg-gray-100'
                    )}
                    aria-label={`Preview ${freq.name}`}
                  >
                    {isPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </button>

                  {/* Playing indicator */}
                  {isPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5">
                      <div className={cn('h-full bg-gradient-to-r animate-shimmer', freq.color)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Binaural Beats ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-sm">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Binaural Beats</h3>
              <p className="text-sm text-muted">Brainwave entrainment &middot; +$0.99</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={binaural?.enabled || false}
            onToggle={handleToggleBinaural}
          />
        </div>

        {binaural?.enabled && (
          <div className="space-y-3 animate-scale-in">
            <p className="text-xs text-muted flex items-center gap-1.5 px-1">
              <Headphones className="w-3 h-3" />
              Best experienced with stereo headphones
            </p>
            <div className="flex flex-wrap gap-2.5">
              {BINAURAL_OPTIONS.map((option) => {
                const isSelected = binaural.band === option.id;
                const isPlaying = playingId === `binaural-${option.id}`;

                return (
                  <div
                    key={option.id}
                    className={cn(
                      'group relative flex-1 min-w-[130px] rounded-xl border-2 transition-all duration-200 overflow-hidden',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onBinauralChange({ ...binaural, band: option.id })}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn('w-3 h-3 rounded-full bg-gradient-to-r', option.color)} />
                        <span className={cn(
                          'font-medium text-sm transition-colors',
                          isSelected ? 'text-primary' : 'text-text'
                        )}>
                          {option.name}
                        </span>
                      </div>
                      <div className="text-xs text-muted">{option.frequency}</div>
                      <div className="text-xs text-muted">{option.benefit}</div>
                    </button>

                    {/* Preview button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(`binaural-${option.id}`, option.previewUrl);
                      }}
                      className={cn(
                        'absolute top-2 right-2 p-1.5 rounded-full transition-all duration-200',
                        isPlaying
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted/40 hover:text-muted hover:bg-gray-100'
                      )}
                      aria-label={`Preview ${option.name}`}
                    >
                      {isPlaying ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </button>

                    {/* Playing indicator */}
                    {isPlaying && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5">
                        <div className={cn('h-full bg-gradient-to-r animate-shimmer', option.color)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Background Music ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-text">Background Music</h3>
            <p className="text-sm text-muted">Ambient soundscapes</p>
          </div>
        </div>

        <div className="space-y-2">
          {MUSIC_OPTIONS.map((option) => {
            const isSelected = music?.id === option.id || (!music && option.id === 'none');
            const isPlaying = playingId === `music-${option.id}`;

            return (
              <div
                key={option.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-200',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    onMusicChange(
                      option.id === 'none'
                        ? undefined
                        : { id: option.id, name: option.name, price: option.price }
                    )
                  }
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <div className={cn('font-medium text-sm', isSelected ? 'text-primary' : 'text-text')}>
                      {option.name}
                    </div>
                    <div className="text-xs text-muted">{option.description}</div>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {option.price > 0 && (
                    <span className="text-sm text-muted">+${option.price.toFixed(2)}</span>
                  )}
                  {option.previewUrl && (
                    <button
                      type="button"
                      onClick={() => handlePreview(`music-${option.id}`, option.previewUrl!)}
                      className={cn(
                        'p-2 rounded-full transition-all duration-200',
                        isPlaying
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-100 text-muted hover:bg-gray-200 hover:text-text'
                      )}
                      aria-label={`Preview ${option.name}`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing Note */}
      <div className="p-4 rounded-xl bg-energy-glow/30 border border-soft">
        <p className="text-sm text-text">
          <span className="font-semibold">First track special!</span> Add-ons are discounted
          for your first creation. Regular pricing applies to future tracks.
        </p>
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
}

function ToggleSwitch({ enabled, onToggle }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative w-12 h-7 rounded-full transition-colors duration-300',
        enabled ? 'bg-primary' : 'bg-gray-200'
      )}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={cn(
          'absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-sm',
          enabled && 'translate-x-5'
        )}
      />
    </button>
  );
}

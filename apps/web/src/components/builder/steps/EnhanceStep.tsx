'use client';

import { useState } from 'react';
import { Music, Waves, Sparkles, Play, Pause, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type BinauralBand = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

interface SolfeggioFrequency {
  value: number;
  name: string;
  benefit: string;
  color: string;
}

interface BinauralOption {
  id: BinauralBand;
  name: string;
  frequency: string;
  benefit: string;
  color: string;
}

interface MusicOption {
  id: string;
  name: string;
  description: string;
  price: number;
}

const SOLFEGGIO_FREQUENCIES: SolfeggioFrequency[] = [
  { value: 174, name: '174 Hz', benefit: 'Pain Relief', color: 'from-red-400 to-orange-500' },
  { value: 285, name: '285 Hz', benefit: 'Healing', color: 'from-orange-400 to-amber-500' },
  { value: 396, name: '396 Hz', benefit: 'Liberation', color: 'from-amber-400 to-yellow-500' },
  { value: 417, name: '417 Hz', benefit: 'Change', color: 'from-yellow-400 to-lime-500' },
  { value: 528, name: '528 Hz', benefit: 'Love & DNA Repair', color: 'from-emerald-400 to-teal-500' },
  { value: 639, name: '639 Hz', benefit: 'Connection', color: 'from-cyan-400 to-blue-500' },
  { value: 741, name: '741 Hz', benefit: 'Awakening', color: 'from-blue-400 to-indigo-500' },
  { value: 852, name: '852 Hz', benefit: 'Intuition', color: 'from-violet-400 to-purple-500' },
  { value: 963, name: '963 Hz', benefit: 'Divine', color: 'from-purple-400 to-pink-500' },
];

const BINAURAL_OPTIONS: BinauralOption[] = [
  { id: 'delta', name: 'Delta', frequency: '0.5-4 Hz', benefit: 'Deep Sleep', color: 'from-indigo-500 to-purple-600' },
  { id: 'theta', name: 'Theta', frequency: '4-8 Hz', benefit: 'Meditation', color: 'from-purple-500 to-pink-500' },
  { id: 'alpha', name: 'Alpha', frequency: '8-13 Hz', benefit: 'Relaxation', color: 'from-blue-500 to-cyan-500' },
  { id: 'beta', name: 'Beta', frequency: '13-30 Hz', benefit: 'Focus', color: 'from-emerald-500 to-teal-500' },
  { id: 'gamma', name: 'Gamma', frequency: '30-100 Hz', benefit: 'Peak Awareness', color: 'from-amber-500 to-orange-500' },
];

const MUSIC_OPTIONS: MusicOption[] = [
  { id: 'none', name: 'No Background Music', description: 'Voice only', price: 0 },
  { id: 'calm-waters', name: 'Calm Waters', description: 'Gentle ocean waves', price: 0.99 },
  { id: 'forest-ambience', name: 'Forest Ambience', description: 'Nature sounds', price: 0.99 },
  { id: 'cosmic-journey', name: 'Cosmic Journey', description: 'Space ambient', price: 0.99 },
  { id: 'meditation-bells', name: 'Meditation Bells', description: 'Tibetan bowls', price: 0.99 },
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
  const [playingMusic, setPlayingMusic] = useState<string | null>(null);

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

      {/* Solfeggio Frequencies */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Solfeggio Frequencies</h3>
              <p className="text-sm text-muted">Ancient healing tones • +$0.99</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={solfeggio?.enabled || false}
            onToggle={handleToggleSolfeggio}
          />
        </div>

        {solfeggio?.enabled && (
          <div className="grid grid-cols-3 gap-2 animate-scale-in">
            {SOLFEGGIO_FREQUENCIES.map((freq) => (
              <button
                key={freq.value}
                type="button"
                onClick={() => onSolfeggioChange({ ...solfeggio, frequency: freq.value })}
                className={cn(
                  'p-3 rounded-xl border-2 text-center transition-all duration-200',
                  solfeggio.frequency === freq.value
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                )}
              >
                <div
                  className={cn(
                    'text-sm font-bold',
                    solfeggio.frequency === freq.value ? 'text-primary' : 'text-text'
                  )}
                >
                  {freq.name}
                </div>
                <div className="text-xs text-muted">{freq.benefit}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Binaural Beats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Binaural Beats</h3>
              <p className="text-sm text-muted">Brainwave entrainment • +$0.99</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={binaural?.enabled || false}
            onToggle={handleToggleBinaural}
          />
        </div>

        {binaural?.enabled && (
          <div className="flex flex-wrap gap-2 animate-scale-in">
            {BINAURAL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onBinauralChange({ ...binaural, band: option.id })}
                className={cn(
                  'flex-1 min-w-[140px] p-3 rounded-xl border-2 text-left transition-all duration-200',
                  binaural.band === option.id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn('w-3 h-3 rounded-full bg-gradient-to-r', option.color)} />
                  <span
                    className={cn(
                      'font-medium text-sm',
                      binaural.band === option.id ? 'text-primary' : 'text-text'
                    )}
                  >
                    {option.name}
                  </span>
                </div>
                <div className="text-xs text-muted">{option.frequency}</div>
                <div className="text-xs text-muted">{option.benefit}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Background Music */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-text">Background Music</h3>
            <p className="text-sm text-muted">Ambient soundscapes</p>
          </div>
        </div>

        <div className="space-y-2">
          {MUSIC_OPTIONS.map((option) => (
            <MusicCard
              key={option.id}
              option={option}
              isSelected={music?.id === option.id || (!music && option.id === 'none')}
              isPlaying={playingMusic === option.id}
              onSelect={() =>
                onMusicChange(
                  option.id === 'none'
                    ? undefined
                    : { id: option.id, name: option.name, price: option.price }
                )
              }
              onPreview={() => {
                if (playingMusic === option.id) {
                  setPlayingMusic(null);
                } else {
                  setPlayingMusic(option.id);
                  setTimeout(() => setPlayingMusic(null), 5000);
                }
              }}
            />
          ))}
        </div>
      </div>

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
        'relative w-12 h-7 rounded-full transition-colors duration-200',
        enabled ? 'bg-primary' : 'bg-gray-200'
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm',
          enabled && 'translate-x-5'
        )}
      />
    </button>
  );
}

interface MusicCardProps {
  option: MusicOption;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

function MusicCard({ option, isSelected, isPlaying, onSelect, onPreview }: MusicCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-200',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-gray-100 bg-white hover:border-gray-200'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-3 flex-1 text-left"
      >
        <div
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            isSelected ? 'border-primary bg-primary' : 'border-gray-300'
          )}
        >
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
        {option.id !== 'none' && (
          <button
            type="button"
            onClick={onPreview}
            className={cn(
              'p-2 rounded-full transition-colors',
              isPlaying
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-muted hover:bg-gray-200'
            )}
            aria-label={`Preview ${option.name}`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

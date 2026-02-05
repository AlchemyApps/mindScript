'use client';

import { useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type VoiceProvider = 'openai' | 'elevenlabs';

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  provider: VoiceProvider;
  preview?: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and versatile', provider: 'openai' },
  { id: 'echo', name: 'Echo', description: 'Warm male voice', provider: 'openai' },
  { id: 'fable', name: 'Fable', description: 'British accent', provider: 'openai' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and resonant', provider: 'openai' },
  { id: 'nova', name: 'Nova', description: 'Clear female voice', provider: 'openai' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft and gentle', provider: 'openai' },
  { id: 'rachel', name: 'Rachel', description: 'Natural and warm', provider: 'elevenlabs' },
  { id: 'domi', name: 'Domi', description: 'Strong and confident', provider: 'elevenlabs' },
  { id: 'bella', name: 'Bella', description: 'Soft and calming', provider: 'elevenlabs' },
];

const DURATION_OPTIONS = [
  { value: 5, label: '5 min', description: 'Quick session' },
  { value: 10, label: '10 min', description: 'Standard' },
  { value: 15, label: '15 min', description: 'Deep practice' },
];

interface VoiceStepProps {
  selectedVoice: { provider: VoiceProvider; voice_id: string; name: string };
  duration: number;
  loopEnabled: boolean;
  loopPause: number;
  onVoiceChange: (voice: { provider: VoiceProvider; voice_id: string; name: string }) => void;
  onDurationChange: (duration: number) => void;
  onLoopChange: (enabled: boolean, pause: number) => void;
  className?: string;
}

export function VoiceStep({
  selectedVoice,
  duration,
  loopEnabled,
  loopPause,
  onVoiceChange,
  onDurationChange,
  onLoopChange,
  className,
}: VoiceStepProps) {
  const [selectedProvider, setSelectedProvider] = useState<VoiceProvider>(selectedVoice.provider);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const filteredVoices = VOICE_OPTIONS.filter((v) => v.provider === selectedProvider);

  const handleProviderChange = (provider: VoiceProvider) => {
    setSelectedProvider(provider);
    const firstVoice = VOICE_OPTIONS.find((v) => v.provider === provider);
    if (firstVoice) {
      onVoiceChange({
        provider,
        voice_id: firstVoice.id,
        name: firstVoice.name,
      });
    }
  };

  const handlePreviewVoice = (voiceId: string) => {
    if (playingVoice === voiceId) {
      setPlayingVoice(null);
    } else {
      setPlayingVoice(voiceId);
      // Simulate audio preview ending
      setTimeout(() => setPlayingVoice(null), 3000);
    }
  };

  return (
    <div className={cn('space-y-8', className)}>
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold font-heading text-text">
          Choose your voice
        </h2>
        <p className="text-muted">
          Select a voice that resonates with you
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text">Voice Provider</label>
        <div className="grid grid-cols-2 gap-4">
          <ProviderCard
            name="OpenAI"
            description="Natural AI voices"
            isSelected={selectedProvider === 'openai'}
            onClick={() => handleProviderChange('openai')}
          />
          <ProviderCard
            name="ElevenLabs"
            description="Premium realistic voices"
            isSelected={selectedProvider === 'elevenlabs'}
            onClick={() => handleProviderChange('elevenlabs')}
          />
        </div>
      </div>

      {/* Voice Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text">Select Voice</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredVoices.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              isSelected={selectedVoice.voice_id === voice.id}
              isPlaying={playingVoice === voice.id}
              onSelect={() =>
                onVoiceChange({
                  provider: voice.provider,
                  voice_id: voice.id,
                  name: voice.name,
                })
              }
              onPreview={() => handlePreviewVoice(voice.id)}
            />
          ))}
        </div>
      </div>

      {/* Duration Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text">Track Duration</label>
        <div className="grid grid-cols-3 gap-3">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onDurationChange(option.value)}
              className={cn(
                'p-4 rounded-xl border-2 text-center transition-all duration-200 hover-lift',
                duration === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              )}
            >
              <div
                className={cn(
                  'text-xl font-bold',
                  duration === option.value ? 'text-primary' : 'text-text'
                )}
              >
                {option.label}
              </div>
              <div className="text-xs text-muted mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Loop Settings */}
      <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-text">Loop Script</h4>
            <p className="text-sm text-muted">Repeat your affirmations throughout the track</p>
          </div>
          <button
            type="button"
            onClick={() => onLoopChange(!loopEnabled, loopPause)}
            className={cn(
              'relative w-12 h-7 rounded-full transition-colors duration-200',
              loopEnabled ? 'bg-primary' : 'bg-gray-200'
            )}
          >
            <span
              className={cn(
                'absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm',
                loopEnabled && 'translate-x-5'
              )}
            />
          </button>
        </div>

        {loopEnabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Pause between loops</span>
              <span className="font-medium text-text">{loopPause}s</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={loopPause}
              onChange={(e) => onLoopChange(loopEnabled, Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>1s</span>
              <span>30s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProviderCardProps {
  name: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
}

function ProviderCard({ name, description, isSelected, onClick }: ProviderCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border-2 text-left transition-all duration-200 hover-lift',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-gray-100 bg-white hover:border-gray-200'
      )}
    >
      <div className={cn('font-semibold', isSelected ? 'text-primary' : 'text-text')}>
        {name}
      </div>
      <div className="text-sm text-muted">{description}</div>
    </button>
  );
}

interface VoiceCardProps {
  voice: VoiceOption;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

function VoiceCard({ voice, isSelected, isPlaying, onSelect, onPreview }: VoiceCardProps) {
  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border-2 transition-all duration-200',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-gray-100 bg-white hover:border-gray-200'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left"
      >
        {/* Waveform visualization placeholder */}
        <div className="mb-3 flex items-center justify-center h-8">
          <div className="flex items-end gap-0.5 h-full">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1 rounded-full transition-all duration-300',
                  isSelected ? 'bg-primary' : 'bg-gray-300',
                  isPlaying && 'animate-pulse'
                )}
                style={{
                  height: `${20 + Math.sin(i * 0.8) * 40 + Math.random() * 20}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <div className={cn('font-medium', isSelected ? 'text-primary' : 'text-text')}>
          {voice.name}
        </div>
        <div className="text-xs text-muted">{voice.description}</div>
      </button>

      {/* Preview button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        className={cn(
          'absolute top-2 right-2 p-1.5 rounded-full transition-colors',
          'bg-gray-100 hover:bg-gray-200 text-muted hover:text-text'
        )}
        aria-label={`Preview ${voice.name}`}
      >
        {isPlaying ? <Pause className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      </button>
    </div>
  );
}

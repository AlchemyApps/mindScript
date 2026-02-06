'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { VoicePicker } from '../VoicePicker';
import { type VoiceMetadata, type VoiceTier } from '@mindscript/schemas';

export type VoiceProvider = 'openai' | 'elevenlabs';

// Extended voice data that includes tier info for pricing
export interface VoiceSelection {
  provider: VoiceProvider;
  voice_id: string;
  name: string;
  tier?: VoiceTier;
  internalCode?: string;
}

const DURATION_OPTIONS = [
  { value: 5, label: '5 min', description: 'Quick session' },
  { value: 10, label: '10 min', description: 'Standard' },
  { value: 15, label: '15 min', description: 'Deep practice' },
];

interface VoiceStepProps {
  selectedVoice: VoiceSelection;
  duration: number;
  loopEnabled: boolean;
  loopPause: number;
  scriptLength?: number;
  isAuthenticated?: boolean;
  onVoiceChange: (voice: VoiceSelection) => void;
  onDurationChange: (duration: number) => void;
  onLoopChange: (enabled: boolean, pause: number) => void;
  className?: string;
}

export function VoiceStep({
  selectedVoice,
  duration,
  loopEnabled,
  loopPause,
  scriptLength = 0,
  isAuthenticated = false,
  onVoiceChange,
  onDurationChange,
  onLoopChange,
  className,
}: VoiceStepProps) {
  // Track the selected VoiceMetadata for the picker
  const [selectedVoiceMetadata, setSelectedVoiceMetadata] = useState<VoiceMetadata | null>(null);

  // Handle voice selection from VoicePicker
  const handleVoiceSelect = (voice: VoiceMetadata) => {
    setSelectedVoiceMetadata(voice);
    onVoiceChange({
      provider: voice.provider as VoiceProvider,
      voice_id: voice.providerVoiceId,
      name: voice.displayName,
      tier: voice.tier,
      internalCode: voice.internalCode,
    });
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

      {/* Voice Picker */}
      <VoicePicker
        selectedVoice={selectedVoiceMetadata}
        onVoiceSelect={handleVoiceSelect}
        isAuthenticated={isAuthenticated}
        scriptLength={scriptLength}
      />

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

'use client';

import { useCallback, useEffect, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info, RotateCcw, AlertTriangle } from 'lucide-react';
import { DEFAULT_GAINS } from '@mindscript/audio-engine/constants';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from 'use-debounce';

interface GainControlsProps {
  gains: {
    master: number;
    voice: number;
    music: number;
    solfeggio: number;
    binaural: number;
  };
  activeLayers?: {
    voice: boolean;
    music: boolean;
    solfeggio: boolean;
    binaural: boolean;
  };
  onChange: (gains: GainControlsProps['gains']) => void;
}

interface SliderConfig {
  key: keyof GainControlsProps['gains'];
  label: string;
  min: number;
  max: number;
  description: string;
}

const sliderConfigs: SliderConfig[] = [
  {
    key: 'master',
    label: 'Master Gain',
    min: -20,
    max: 6,
    description: 'Controls the overall output level of all layers combined',
  },
  {
    key: 'voice',
    label: 'Voice Gain',
    min: -10,
    max: 10,
    description: 'Adjusts the volume of the voice narration',
  },
  {
    key: 'music',
    label: 'Music Gain',
    min: -20,
    max: 0,
    description: 'Controls the background music volume',
  },
  {
    key: 'solfeggio',
    label: 'Solfeggio Gain',
    min: -30,
    max: 0,
    description: 'Adjusts the Solfeggio frequency tone volume',
  },
  {
    key: 'binaural',
    label: 'Binaural Gain',
    min: -30,
    max: 0,
    description: 'Controls the binaural beat volume',
  },
];

export function GainControls({
  gains,
  activeLayers = { voice: true, music: true, solfeggio: true, binaural: true },
  onChange,
}: GainControlsProps) {
  const [localGains, setLocalGains] = useState(gains);

  useEffect(() => {
    setLocalGains(gains);
  }, [gains]);

  const debouncedChange = useDebouncedCallback(
    (newGains: GainControlsProps['gains']) => {
      onChange(newGains);
    },
    100
  );

  const handleGainChange = useCallback(
    (key: keyof GainControlsProps['gains'], values: number[]) => {
      const newValue = values[0];
      const newGains = { ...localGains, [key]: newValue };
      setLocalGains(newGains);
      debouncedChange(newGains);
    },
    [localGains, debouncedChange]
  );

  const handleReset = useCallback(() => {
    const defaultGains = {
      master: 0,
      voice: DEFAULT_GAINS.VOICE,
      music: DEFAULT_GAINS.MUSIC,
      solfeggio: DEFAULT_GAINS.SOLFEGGIO,
      binaural: DEFAULT_GAINS.BINAURAL,
    };
    setLocalGains(defaultGains);
    onChange(defaultGains);
  }, [onChange]);

  const getMeterColor = (value: number, max: number) => {
    const percentage = ((value - (-30)) / (max - (-30))) * 100;
    if (percentage > 80) return 'bg-yellow-500';
    if (percentage > 95) return 'bg-red-500';
    return 'bg-green-500';
  };

  const getMeterWidth = (value: number, min: number, max: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  const showClippingWarning = localGains.master >= 5;

  return (
    <div
      className="space-y-4 lg:space-y-6"
      data-testid="gain-controls-container"
      role="group"
      aria-label="Gain controls"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gain Controls</h3>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          aria-label="Reset to defaults"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </button>
      </div>

      {showClippingWarning && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            Warning: High master gain may cause clipping
          </p>
        </div>
      )}

      <div className="space-y-6">
        {sliderConfigs.map((config) => {
          const value = localGains[config.key];
          const isDisabled = config.key !== 'master' && 
            !activeLayers[config.key as keyof typeof activeLayers];
          
          return (
            <div
              key={config.key}
              className="flex flex-col space-y-2"
              data-testid={`slider-group-${config.key}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`gain-${config.key}`}
                    className={cn(
                      'text-sm font-medium',
                      isDisabled && 'text-gray-400'
                    )}
                  >
                    {config.label}
                  </label>
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600"
                          data-testid={`info-icon-${config.key}`}
                          aria-label={`Info about ${config.label}`}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm max-w-xs"
                          sideOffset={5}
                        >
                          {config.description}
                          <Tooltip.Arrow className="fill-gray-900" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </div>
                <span className={cn(
                  'text-sm font-mono',
                  isDisabled && 'text-gray-400'
                )}>
                  {value > 0 && '+'}{value} dB
                </span>
              </div>

              <div className="space-y-2">
                <Slider.Root
                  id={`gain-${config.key}`}
                  className="relative flex items-center select-none touch-none w-full h-5"
                  value={[value]}
                  onValueChange={(values) => handleGainChange(config.key, values)}
                  min={config.min}
                  max={config.max}
                  step={0.5}
                  disabled={isDisabled}
                  aria-label={config.label}
                  aria-describedby={`${config.key}-description`}
                >
                  <Slider.Track className="bg-gray-200 relative grow rounded-full h-2">
                    <Slider.Range className="absolute bg-primary rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb
                    className={cn(
                      'block w-5 h-5 bg-white border-2 border-primary rounded-full',
                      'hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                </Slider.Root>
                <span id={`${config.key}-description`} className="sr-only">
                  {config.description}
                </span>

                {/* Visual meter */}
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'absolute left-0 top-0 h-full transition-all duration-150',
                      getMeterColor(value, config.max)
                    )}
                    style={{ width: `${getMeterWidth(value, config.min, config.max)}%` }}
                    data-testid={`gain-meter-${config.key}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
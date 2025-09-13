'use client';

import { useCallback, useEffect, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { SOLFEGGIO_FREQUENCIES } from '@mindscript/audio-engine/constants';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from 'use-debounce';

interface FrequencyPanelProps {
  selectedFrequency?: number;
  volume: number;
  onChange: (settings: { frequency?: number; volume: number }) => void;
}

export function FrequencyPanel({
  selectedFrequency,
  volume,
  onChange,
}: FrequencyPanelProps) {
  const [localVolume, setLocalVolume] = useState(volume);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  const debouncedVolumeChange = useDebouncedCallback(
    (newVolume: number) => {
      onChange({
        frequency: selectedFrequency,
        volume: newVolume,
      });
    },
    100
  );

  const handleFrequencyChange = useCallback(
    (value: string) => {
      const frequency = value === 'none' ? undefined : parseInt(value, 10);
      onChange({
        frequency,
        volume: localVolume,
      });
    },
    [onChange, localVolume]
  );

  const handleVolumeChange = useCallback(
    (values: number[]) => {
      const newVolume = values[0];
      setLocalVolume(newVolume);
      debouncedVolumeChange(newVolume);
    },
    [debouncedVolumeChange]
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Solfeggio Frequency</h3>
        
        <RadioGroup.Root
          value={selectedFrequency?.toString() || 'none'}
          onValueChange={handleFrequencyChange}
          aria-label="Solfeggio frequency selection"
        >
          <div
            className="grid grid-cols-3 lg:grid-cols-5 gap-3"
            data-testid="frequency-grid"
          >
            {/* None option */}
            <label
              htmlFor="freq-none"
              className={cn(
                'relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all',
                'hover:border-primary',
                selectedFrequency === undefined
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-200'
              )}
              data-testid="frequency-card-none"
            >
              <RadioGroup.Item
                value="none"
                id="freq-none"
                className="sr-only"
                aria-label="None"
              />
              <div className="font-semibold">None</div>
              <div className="text-sm text-gray-600 mt-1">
                Disable Solfeggio frequency
              </div>
            </label>

            {/* Frequency options */}
            {Object.entries(SOLFEGGIO_FREQUENCIES).map(([freq, details]) => {
              const freqNum = parseInt(freq, 10);
              const isSelected = selectedFrequency === freqNum;
              
              return (
                <label
                  key={freq}
                  htmlFor={`freq-${freq}`}
                  className={cn(
                    'relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all',
                    'hover:border-primary',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200'
                  )}
                  data-testid={`frequency-card-${freq}`}
                >
                  <RadioGroup.Item
                    value={freq}
                    id={`freq-${freq}`}
                    className="sr-only"
                    aria-label={`${freq} Hz`}
                  />
                  
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-lg">{freq} Hz</div>
                    <Tooltip.Provider>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <button
                            type="button"
                            className="ml-2 text-gray-400 hover:text-gray-600"
                            data-testid={`info-icon-${freq}`}
                            aria-label={`Info about ${freq} Hz`}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm max-w-xs"
                            sideOffset={5}
                          >
                            {details.description}
                            <Tooltip.Arrow className="fill-gray-900" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </div>
                  
                  <div className="font-medium text-sm mt-1">
                    {details.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {details.description}
                  </div>
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                  )}
                </label>
              );
            })}
          </div>
        </RadioGroup.Root>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="frequency-volume" className="text-sm font-medium">
            Frequency Volume
          </label>
          <span className="text-sm font-mono">{localVolume} dB</span>
        </div>
        
        <Slider.Root
          id="frequency-volume"
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[localVolume]}
          onValueChange={handleVolumeChange}
          min={-30}
          max={0}
          step={1}
          disabled={!selectedFrequency}
          aria-label="Frequency volume"
        >
          <Slider.Track className="bg-gray-200 relative grow rounded-full h-2">
            <Slider.Range className="absolute bg-primary rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb
            className={cn(
              'block w-5 h-5 bg-white border-2 border-primary rounded-full',
              'hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              !selectedFrequency && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Volume slider"
          />
        </Slider.Root>
      </div>
    </div>
  );
}
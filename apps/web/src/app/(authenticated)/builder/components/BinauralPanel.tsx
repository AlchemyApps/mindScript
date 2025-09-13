'use client';

import { useCallback, useEffect, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info, Waves } from 'lucide-react';
import { BINAURAL_BANDS } from '@mindscript/audio-engine/constants';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from 'use-debounce';

interface BinauralPanelProps {
  selectedBand?: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
  carrierFrequency: number;
  volume: number;
  onChange: (settings: {
    band?: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
    carrierFrequency: number;
    volume: number;
  }) => void;
}

export function BinauralPanel({
  selectedBand,
  carrierFrequency,
  volume,
  onChange,
}: BinauralPanelProps) {
  const [localCarrier, setLocalCarrier] = useState(carrierFrequency);
  const [localVolume, setLocalVolume] = useState(volume);

  useEffect(() => {
    setLocalCarrier(carrierFrequency);
  }, [carrierFrequency]);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  const debouncedCarrierChange = useDebouncedCallback(
    (newCarrier: number) => {
      onChange({
        band: selectedBand,
        carrierFrequency: newCarrier,
        volume: localVolume,
      });
    },
    100
  );

  const debouncedVolumeChange = useDebouncedCallback(
    (newVolume: number) => {
      onChange({
        band: selectedBand,
        carrierFrequency: localCarrier,
        volume: newVolume,
      });
    },
    100
  );

  const handleBandChange = useCallback(
    (value: string) => {
      const band = value === 'none' 
        ? undefined 
        : value as 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
      
      onChange({
        band,
        carrierFrequency: localCarrier,
        volume: localVolume,
      });
    },
    [onChange, localCarrier, localVolume]
  );

  const handleCarrierChange = useCallback(
    (values: number[]) => {
      const newCarrier = values[0];
      setLocalCarrier(newCarrier);
      debouncedCarrierChange(newCarrier);
    },
    [debouncedCarrierChange]
  );

  const handleVolumeChange = useCallback(
    (values: number[]) => {
      const newVolume = values[0];
      setLocalVolume(newVolume);
      debouncedVolumeChange(newVolume);
    },
    [debouncedVolumeChange]
  );

  const getBeatFrequency = (band?: string) => {
    if (!band || !BINAURAL_BANDS[band as keyof typeof BINAURAL_BANDS]) return 0;
    const range = BINAURAL_BANDS[band as keyof typeof BINAURAL_BANDS].range;
    return (range[0] + range[1]) / 2;
  };

  const bandColors = {
    delta: 'blue',
    theta: 'indigo',
    alpha: 'green',
    beta: 'yellow',
    gamma: 'orange',
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Binaural Beat Band</h3>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="binaural-info-icon"
                  aria-label="Info about binaural beats"
                >
                  <Info className="h-5 w-5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm max-w-xs"
                  sideOffset={5}
                >
                  Binaural beats create a perceived frequency difference between your ears, 
                  potentially inducing various mental states.
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        
        <RadioGroup.Root
          value={selectedBand || 'none'}
          onValueChange={handleBandChange}
          aria-label="Binaural beat band selection"
        >
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
            data-testid="band-grid"
          >
            {/* None option */}
            <label
              htmlFor="band-none"
              className={cn(
                'relative flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all',
                'hover:border-primary',
                selectedBand === undefined
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-200'
              )}
              data-testid="band-card-none"
            >
              <RadioGroup.Item
                value="none"
                id="band-none"
                className="sr-only"
                aria-label="None"
              />
              <div className="font-semibold text-sm">None</div>
              <div className="text-xs text-gray-600 mt-1">
                Disable binaural beats
              </div>
            </label>

            {/* Band options */}
            {Object.entries(BINAURAL_BANDS).map(([band, details]) => {
              const isSelected = selectedBand === band;
              const color = bandColors[band as keyof typeof bandColors];
              
              return (
                <label
                  key={band}
                  htmlFor={`band-${band}`}
                  className={cn(
                    'relative flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all',
                    'hover:border-primary',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200'
                  )}
                  data-testid={`band-card-${band}`}
                  data-color={color}
                >
                  <RadioGroup.Item
                    value={band}
                    id={`band-${band}`}
                    className="sr-only"
                    aria-label={band}
                  />
                  
                  <div className="flex items-center gap-1 mb-1">
                    <Waves className={cn('h-4 w-4', `text-${color}-500`)} />
                    <div className="font-semibold text-sm capitalize">{band}</div>
                  </div>
                  
                  <div className="text-xs text-gray-600">
                    {details.range[0]}-{details.range[1]} Hz
                  </div>
                  
                  <div className="font-medium text-xs mt-1">
                    {details.name}
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {details.description}
                  </div>
                  
                  {isSelected && (
                    <div
                      className="mt-2 h-1 bg-gradient-to-r rounded-full"
                      style={{
                        backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`,
                      }}
                      data-testid="frequency-range-bar"
                      data-band={band}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </RadioGroup.Root>
      </div>

      {selectedBand && (
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          Beat frequency: {getBeatFrequency(selectedBand)} Hz
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="carrier-frequency" className="text-sm font-medium">
              Carrier Frequency
            </label>
            <span className="text-sm font-mono">{localCarrier} Hz</span>
          </div>
          
          <Slider.Root
            id="carrier-frequency"
            className="relative flex items-center select-none touch-none w-full h-5"
            value={[localCarrier]}
            onValueChange={handleCarrierChange}
            min={200}
            max={500}
            step={10}
            disabled={!selectedBand}
            aria-label="Carrier frequency"
          >
            <Slider.Track className="bg-gray-200 relative grow rounded-full h-2">
              <Slider.Range className="absolute bg-primary rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb
              className={cn(
                'block w-5 h-5 bg-white border-2 border-primary rounded-full',
                'hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                !selectedBand && 'opacity-50 cursor-not-allowed'
              )}
              aria-label="Carrier frequency slider"
            />
          </Slider.Root>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="binaural-volume" className="text-sm font-medium">
              Binaural Volume
            </label>
            <span className="text-sm font-mono">{localVolume} dB</span>
          </div>
          
          <Slider.Root
            id="binaural-volume"
            className="relative flex items-center select-none touch-none w-full h-5"
            value={[localVolume]}
            onValueChange={handleVolumeChange}
            min={-30}
            max={0}
            step={1}
            disabled={!selectedBand}
            aria-label="Binaural volume"
          >
            <Slider.Track className="bg-gray-200 relative grow rounded-full h-2">
              <Slider.Range className="absolute bg-primary rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb
              className={cn(
                'block w-5 h-5 bg-white border-2 border-primary rounded-full',
                'hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                !selectedBand && 'opacity-50 cursor-not-allowed'
              )}
              aria-label="Volume slider"
            />
          </Slider.Root>
        </div>
      </div>
    </div>
  );
}
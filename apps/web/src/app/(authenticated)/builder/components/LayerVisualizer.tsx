'use client';

import { useMemo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { 
  Mic, 
  Music, 
  Waves, 
  Brain, 
  Info,
  AlertTriangle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayerVisualizerProps {
  layers: {
    voice: { enabled: boolean; gain: number };
    music: { enabled: boolean; gain: number };
    solfeggio: { enabled: boolean; gain: number };
    binaural: { enabled: boolean; gain: number };
  };
  masterGain?: number;
  isPlaying?: boolean;
  onToggle: (layer: keyof LayerVisualizerProps['layers'], enabled: boolean) => void;
}

interface LayerConfig {
  key: keyof LayerVisualizerProps['layers'];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  requires?: keyof LayerVisualizerProps['layers'];
}

const layerConfigs: LayerConfig[] = [
  {
    key: 'voice',
    label: 'Voice',
    icon: Mic,
    color: 'blue',
    description: 'Main voice narration layer',
  },
  {
    key: 'music',
    label: 'Music',
    icon: Music,
    color: 'green',
    description: 'Background music layer',
    requires: 'voice',
  },
  {
    key: 'solfeggio',
    label: 'Solfeggio',
    icon: Waves,
    color: 'purple',
    description: 'Solfeggio frequency tones',
  },
  {
    key: 'binaural',
    label: 'Binaural',
    icon: Brain,
    color: 'orange',
    description: 'Binaural beat frequencies',
  },
];

export function LayerVisualizer({
  layers,
  masterGain = 0,
  isPlaying = false,
  onToggle,
}: LayerVisualizerProps) {
  const warnings = useMemo(() => {
    const warns: string[] = [];
    
    // Check for music without voice
    if (layers.music.enabled && !layers.voice.enabled) {
      warns.push('Music requires voice layer');
    }
    
    // Check for solo solfeggio or binaural (allowed but not recommended)
    const enabledCount = Object.values(layers).filter(l => l.enabled).length;
    if (enabledCount === 1) {
      if (layers.solfeggio.enabled) {
        warns.push('Solfeggio works best with other layers');
      }
      if (layers.binaural.enabled) {
        warns.push('Binaural works best with other layers');
      }
    }
    
    return warns;
  }, [layers]);

  const hasClippingRisk = useMemo(() => {
    const totalGain = Object.entries(layers)
      .filter(([_, layer]) => layer.enabled)
      .reduce((sum, [_, layer]) => sum + layer.gain, masterGain);
    
    return totalGain > 3;
  }, [layers, masterGain]);

  const getEffectiveGain = (layerGain: number) => {
    return layerGain + masterGain;
  };

  const getMeterWidth = (gain: number) => {
    // Map gain from -30 to +10 range to 0-100%
    const normalized = (gain + 30) / 40;
    return Math.max(0, Math.min(100, normalized * 100));
  };

  const isMuted = (gain: number) => gain <= -60;

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="space-y-1">
            {warnings.map((warning, index) => (
              <p key={index} className="text-sm text-yellow-800">
                {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      {hasClippingRisk && (
        <div
          className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
          data-testid="clipping-warning"
        >
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-800">
            Risk of audio clipping - reduce gain levels
          </p>
        </div>
      )}

      <div
        className="flex flex-wrap gap-4 justify-center"
        data-testid="layers-container"
      >
        {layerConfigs.map((config) => {
          const layer = layers[config.key];
          const effectiveGain = getEffectiveGain(layer.gain);
          const muted = isMuted(layer.gain);
          const Icon = config.icon;
          
          return (
            <button
              key={config.key}
              type="button"
              onClick={() => onToggle(config.key, !layer.enabled)}
              className={cn(
                'relative flex flex-col items-center p-4 rounded-lg border-2',
                'transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2',
                layer.enabled
                  ? `bg-${config.color}-50 border-${config.color}-300 focus:ring-${config.color}-500`
                  : 'bg-gray-50 border-gray-300 focus:ring-gray-500',
                layer.enabled && isPlaying && 'animate-pulse'
              )}
              data-testid={`layer-${config.key}`}
              data-color={config.color}
              data-requires={config.requires}
              role="button"
              aria-label={`${config.label} layer`}
              aria-pressed={layer.enabled}
              title={`Effective: ${effectiveGain.toFixed(1)} dB`}
            >
              {/* Icon */}
              <div className="relative">
                <Icon
                  className={cn(
                    'h-8 w-8',
                    layer.enabled ? `text-${config.color}-600` : 'text-gray-400',
                    muted && 'opacity-50'
                  )}
                  data-testid={`icon-${config.key}`}
                />
                {muted && (
                  <VolumeX className="absolute -bottom-1 -right-1 h-4 w-4 text-gray-600" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-sm font-medium',
                  layer.enabled ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                {config.label}
              </span>

              {/* Gain display */}
              <span
                className={cn(
                  'text-xs font-mono mt-1',
                  layer.enabled ? 'text-gray-700' : 'text-gray-400'
                )}
              >
                {layer.gain > 0 && '+'}{layer.gain} dB
              </span>

              {/* Muted indicator */}
              {muted && layer.enabled && (
                <span className="absolute top-1 right-1 text-xs text-gray-500">
                  Muted
                </span>
              )}

              {/* Gain meter */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-md overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-150',
                    layer.enabled
                      ? effectiveGain > 0
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                      : 'bg-gray-300'
                  )}
                  style={{ width: `${getMeterWidth(layer.gain)}%` }}
                  data-testid={`gain-meter-${config.key}`}
                />
              </div>

              {/* Info tooltip */}
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div
                      className="absolute top-1 left-1 text-gray-400 hover:text-gray-600"
                      data-testid={`info-${config.key}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-4 w-4" />
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm max-w-xs"
                      sideOffset={5}
                    >
                      {config.description}
                      {config.requires && (
                        <span className="block mt-1 text-xs text-gray-300">
                          Requires: {config.requires} layer
                        </span>
                      )}
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>

              {/* Active indicator */}
              {layer.enabled && (
                <div
                  className={cn(
                    'absolute -top-1 -right-1 w-3 h-3 rounded-full',
                    `bg-${config.color}-500`,
                    isPlaying && 'animate-ping'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
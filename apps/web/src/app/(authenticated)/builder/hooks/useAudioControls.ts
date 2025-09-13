import { useState, useCallback, useEffect } from 'react';
import { DEFAULT_GAINS } from '@mindscript/audio-engine/constants';
import type { AudioControlSettings } from '../components/presets';

interface UseAudioControlsOptions {
  onChange?: (settings: AudioControlSettings) => void;
  initialSettings?: Partial<AudioControlSettings>;
}

export function useAudioControls(options: UseAudioControlsOptions = {}) {
  const { onChange, initialSettings } = options;

  const [settings, setSettings] = useState<AudioControlSettings>({
    gains: {
      master: 0,
      voice: DEFAULT_GAINS.VOICE,
      music: DEFAULT_GAINS.MUSIC,
      solfeggio: DEFAULT_GAINS.SOLFEGGIO,
      binaural: DEFAULT_GAINS.BINAURAL,
    },
    ...initialSettings,
  });

  const [activeLayers, setActiveLayers] = useState({
    voice: true,
    music: false,
    solfeggio: false,
    binaural: false,
  });

  // Notify parent of changes
  useEffect(() => {
    onChange?.(settings);
  }, [settings, onChange]);

  const updateSolfeggio = useCallback((solfeggio?: AudioControlSettings['solfeggio']) => {
    setSettings(prev => ({ ...prev, solfeggio }));
    setActiveLayers(prev => ({ ...prev, solfeggio: !!solfeggio }));
  }, []);

  const updateBinaural = useCallback((binaural?: AudioControlSettings['binaural']) => {
    setSettings(prev => ({ ...prev, binaural }));
    setActiveLayers(prev => ({ ...prev, binaural: !!binaural }));
  }, []);

  const updateGains = useCallback((gains: AudioControlSettings['gains']) => {
    setSettings(prev => ({ ...prev, gains }));
  }, []);

  const toggleLayer = useCallback((layer: keyof typeof activeLayers, enabled: boolean) => {
    setActiveLayers(prev => {
      const updated = { ...prev, [layer]: enabled };
      
      // Enforce rules: music requires voice
      if (layer === 'voice' && !enabled && prev.music) {
        updated.music = false;
      }
      
      return updated;
    });

    // Disable the frequency/binaural if layer is turned off
    if (!enabled) {
      if (layer === 'solfeggio') {
        setSettings(prev => ({ ...prev, solfeggio: undefined }));
      } else if (layer === 'binaural') {
        setSettings(prev => ({ ...prev, binaural: undefined }));
      }
    }
  }, []);

  const loadPreset = useCallback((presetSettings: AudioControlSettings) => {
    setSettings(presetSettings);
    setActiveLayers({
      voice: presetSettings.gains.voice > -60,
      music: presetSettings.gains.music > -60,
      solfeggio: !!presetSettings.solfeggio,
      binaural: !!presetSettings.binaural,
    });
  }, []);

  const reset = useCallback(() => {
    setSettings({
      gains: {
        master: 0,
        voice: DEFAULT_GAINS.VOICE,
        music: DEFAULT_GAINS.MUSIC,
        solfeggio: DEFAULT_GAINS.SOLFEGGIO,
        binaural: DEFAULT_GAINS.BINAURAL,
      },
    });
    setActiveLayers({
      voice: true,
      music: false,
      solfeggio: false,
      binaural: false,
    });
  }, []);

  const validateSettings = useCallback(() => {
    const errors: string[] = [];
    
    // Check if at least one layer is active
    const hasActiveLayer = Object.values(activeLayers).some(v => v);
    if (!hasActiveLayer) {
      errors.push('At least one audio layer must be enabled');
    }
    
    // Check if music is enabled without voice
    if (activeLayers.music && !activeLayers.voice) {
      errors.push('Background music requires voice to be enabled');
    }
    
    // Check for clipping risk
    const totalGain = Object.entries(activeLayers)
      .filter(([_, enabled]) => enabled)
      .reduce((sum, [key]) => {
        const layerKey = key as keyof typeof settings.gains;
        return sum + settings.gains[layerKey];
      }, settings.gains.master);
    
    if (totalGain > 3) {
      errors.push('Combined gain levels may cause audio clipping');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [settings, activeLayers]);

  return {
    settings,
    activeLayers,
    updateSolfeggio,
    updateBinaural,
    updateGains,
    toggleLayer,
    loadPreset,
    reset,
    validateSettings,
  };
}
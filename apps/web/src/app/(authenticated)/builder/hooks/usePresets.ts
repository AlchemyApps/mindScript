import { useState, useCallback, useEffect } from 'react';
import {
  DEFAULT_PRESETS,
  PRESET_STORAGE_KEY,
  MAX_CUSTOM_PRESETS,
  type Preset,
  type AudioControlSettings,
} from '../components/presets';

export function usePresets() {
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load custom presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      if (stored) {
        const presets = JSON.parse(stored);
        if (Array.isArray(presets)) {
          setCustomPresets(presets);
        }
      }
    } catch (error) {
      console.error('Failed to load custom presets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save custom presets to localStorage
  const saveToStorage = useCallback((presets: Preset[]) => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      setCustomPresets(presets);
      return true;
    } catch (error) {
      console.error('Failed to save custom presets:', error);
      return false;
    }
  }, []);

  const savePreset = useCallback((
    name: string,
    description: string,
    settings: AudioControlSettings
  ): { success: boolean; error?: string } => {
    if (!name.trim()) {
      return { success: false, error: 'Preset name is required' };
    }

    // Check for duplicate names
    const isDuplicate = [...DEFAULT_PRESETS, ...customPresets].some(
      p => p.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (isDuplicate) {
      return { success: false, error: 'A preset with this name already exists' };
    }

    if (customPresets.length >= MAX_CUSTOM_PRESETS) {
      return { success: false, error: `Maximum of ${MAX_CUSTOM_PRESETS} custom presets allowed` };
    }

    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      isDefault: false,
      settings,
    };

    const updated = [...customPresets, newPreset];
    const saved = saveToStorage(updated);
    
    return { success: saved };
  }, [customPresets, saveToStorage]);

  const deletePreset = useCallback((id: string): boolean => {
    const preset = customPresets.find(p => p.id === id);
    if (!preset || preset.isDefault) {
      return false;
    }

    const updated = customPresets.filter(p => p.id !== id);
    return saveToStorage(updated);
  }, [customPresets, saveToStorage]);

  const updatePreset = useCallback((
    id: string,
    updates: Partial<Omit<Preset, 'id' | 'isDefault'>>
  ): boolean => {
    const presetIndex = customPresets.findIndex(p => p.id === id);
    if (presetIndex === -1) {
      return false;
    }

    const updated = [...customPresets];
    updated[presetIndex] = {
      ...updated[presetIndex],
      ...updates,
    };

    return saveToStorage(updated);
  }, [customPresets, saveToStorage]);

  const exportPresets = useCallback((): string => {
    return JSON.stringify(customPresets, null, 2);
  }, [customPresets]);

  const importPresets = useCallback((
    data: string,
    merge: boolean = true
  ): { success: boolean; count: number; error?: string } => {
    try {
      const imported = JSON.parse(data);
      
      if (!Array.isArray(imported)) {
        return { success: false, count: 0, error: 'Invalid preset file format' };
      }

      // Validate presets
      const validPresets = imported.filter(p => 
        p.id && 
        p.name && 
        p.settings && 
        p.settings.gains &&
        !p.isDefault // Don't import default presets
      );

      if (validPresets.length === 0) {
        return { success: false, count: 0, error: 'No valid presets found in file' };
      }

      // Generate new IDs to avoid conflicts
      const remappedPresets = validPresets.map(p => ({
        ...p,
        id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      const finalPresets = merge
        ? [...customPresets, ...remappedPresets].slice(0, MAX_CUSTOM_PRESETS)
        : remappedPresets.slice(0, MAX_CUSTOM_PRESETS);

      const saved = saveToStorage(finalPresets);
      
      return {
        success: saved,
        count: saved ? remappedPresets.length : 0,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error: 'Failed to parse preset file',
      };
    }
  }, [customPresets, saveToStorage]);

  const getAllPresets = useCallback((): Preset[] => {
    return [...DEFAULT_PRESETS, ...customPresets];
  }, [customPresets]);

  const getPresetById = useCallback((id: string): Preset | undefined => {
    return getAllPresets().find(p => p.id === id);
  }, [getAllPresets]);

  const findMatchingPreset = useCallback((
    settings: AudioControlSettings
  ): Preset | undefined => {
    return getAllPresets().find(preset =>
      JSON.stringify(preset.settings) === JSON.stringify(settings)
    );
  }, [getAllPresets]);

  return {
    defaultPresets: DEFAULT_PRESETS,
    customPresets,
    allPresets: getAllPresets(),
    isLoading,
    savePreset,
    deletePreset,
    updatePreset,
    exportPresets,
    importPresets,
    getPresetById,
    findMatchingPreset,
    canSaveMore: customPresets.length < MAX_CUSTOM_PRESETS,
  };
}
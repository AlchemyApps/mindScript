'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Check,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PRESETS,
  PRESET_STORAGE_KEY,
  MAX_CUSTOM_PRESETS,
  type Preset,
  type AudioControlSettings,
} from './presets';

interface PresetManagerProps {
  currentSettings: AudioControlSettings;
  onLoad: (settings: AudioControlSettings) => void;
}

export function PresetManager({ currentSettings, onLoad }: PresetManagerProps) {
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFormData, setSaveFormData] = useState({ name: '', description: '' });
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    }
  }, []);

  // Save custom presets to localStorage
  const saveCustomPresets = useCallback((presets: Preset[]) => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      setCustomPresets(presets);
    } catch (error) {
      console.error('Failed to save custom presets:', error);
    }
  }, []);

  const handleSavePreset = useCallback(() => {
    const { name, description } = saveFormData;
    
    if (!name.trim()) {
      setSaveError('Please enter a preset name');
      return;
    }

    // Check for duplicate names
    const isDuplicate = [...DEFAULT_PRESETS, ...customPresets].some(
      p => p.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (isDuplicate) {
      setSaveError('A preset with this name already exists');
      return;
    }

    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      isDefault: false,
      settings: currentSettings,
    };

    const updated = [...customPresets, newPreset];
    saveCustomPresets(updated);
    
    setShowSaveDialog(false);
    setSaveFormData({ name: '', description: '' });
    setSaveError('');
  }, [saveFormData, currentSettings, customPresets, saveCustomPresets]);

  const handleDeletePreset = useCallback((id: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;
    
    const updated = customPresets.filter(p => p.id !== id);
    saveCustomPresets(updated);
  }, [customPresets, saveCustomPresets]);

  const handleExport = useCallback(() => {
    const data = JSON.stringify(customPresets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindscript-presets-${Date.now()}.json`;
    a.click();
    a.remove();
    
    URL.revokeObjectURL(url);
  }, [customPresets]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        
        if (!Array.isArray(imported)) {
          throw new Error('Invalid preset file format');
        }

        // Validate and merge
        const validPresets = imported.filter(p => 
          p.id && p.name && p.settings && !p.isDefault
        );
        
        const merged = [...customPresets, ...validPresets].slice(0, MAX_CUSTOM_PRESETS);
        saveCustomPresets(merged);
      } catch (error) {
        alert('Failed to import presets. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [customPresets, saveCustomPresets]);

  const isActivePreset = useCallback((preset: Preset) => {
    return JSON.stringify(preset.settings) === JSON.stringify(currentSettings);
  }, [currentSettings]);

  const filteredPresets = [...DEFAULT_PRESETS, ...customPresets].filter(preset => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      preset.name.toLowerCase().includes(search) ||
      preset.description?.toLowerCase().includes(search)
    );
  });

  const canSaveMore = customPresets.length < MAX_CUSTOM_PRESETS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Presets</h3>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSaveDialog(true)}
            disabled={!canSaveMore}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md',
              'bg-primary text-white hover:bg-primary/90',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Save current settings"
          >
            <Save className="h-4 w-4" />
            Save Current
          </button>
          
          <button
            type="button"
            onClick={handleExport}
            disabled={customPresets.length === 0}
            className={cn(
              'p-1.5 text-gray-600 hover:text-gray-900',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Export presets"
          >
            <Download className="h-4 w-4" />
          </button>
          
          <label className="p-1.5 text-gray-600 hover:text-gray-900 cursor-pointer">
            <Upload className="h-4 w-4" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="sr-only"
              data-testid="import-file-input"
              aria-label="Import presets"
            />
          </label>
        </div>
      </div>

      {!canSaveMore && (
        <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
          Maximum preset limit reached ({MAX_CUSTOM_PRESETS} custom presets)
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search presets..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Preset Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="presets-grid"
      >
        {filteredPresets.map((preset) => {
          const isActive = isActivePreset(preset);
          
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onLoad(preset.settings)}
              className={cn(
                'relative text-left p-4 rounded-lg border-2 transition-all',
                'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isActive
                  ? 'border-primary ring-2 ring-primary bg-primary/5'
                  : 'border-gray-200'
              )}
              data-testid={`preset-card-${preset.id}`}
              aria-label={preset.name}
            >
              {isActive && (
                <div className="absolute top-2 right-2">
                  <span className="flex items-center gap-1 text-xs text-primary font-medium">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                </div>
              )}
              
              <div className="pr-12">
                <h4 className="font-semibold">{preset.name}</h4>
                {preset.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {preset.description}
                  </p>
                )}
              </div>
              
              {!preset.isDefault && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePreset(preset.id);
                  }}
                  className="absolute bottom-2 right-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label={`Delete ${preset.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Save Preset</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="preset-name" className="block text-sm font-medium mb-1">
                  Preset Name
                </label>
                <input
                  id="preset-name"
                  type="text"
                  value={saveFormData.name}
                  onChange={(e) => {
                    setSaveFormData({ ...saveFormData, name: e.target.value });
                    setSaveError('');
                  }}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter preset name"
                />
              </div>
              
              <div>
                <label htmlFor="preset-description" className="block text-sm font-medium mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="preset-description"
                  value={saveFormData.description}
                  onChange={(e) => setSaveFormData({ ...saveFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Describe this preset"
                />
              </div>
              
              {saveError && (
                <div className="text-sm text-red-600">
                  {saveError}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveFormData({ name: '', description: '' });
                  setSaveError('');
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label="Save preset"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
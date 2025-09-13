'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@mindscript/ui/utils/cn';
import { VoiceProviderSchema, OpenAIVoiceSchema } from '@mindscript/schemas/audio';
import type { z } from 'zod';

interface Voice {
  id: string;
  name: string;
  description: string;
  provider: z.infer<typeof VoiceProviderSchema>;
}

interface VoiceSettings {
  speed?: number;
  pitch?: number;
}

interface VoiceSelection {
  provider: z.infer<typeof VoiceProviderSchema>;
  voice_id: string;
  settings?: VoiceSettings;
  file?: File;
}

interface VoiceSelectorProps {
  value: VoiceSelection;
  onChange: (value: VoiceSelection) => void;
  onPreview?: (provider: string, voiceId: string) => void;
  className?: string;
}

const OPENAI_VOICES: Voice[] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced', provider: 'openai' },
  { id: 'echo', name: 'Echo', description: 'Warm and engaging', provider: 'openai' },
  { id: 'fable', name: 'Fable', description: 'Expressive and dynamic', provider: 'openai' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative', provider: 'openai' },
  { id: 'nova', name: 'Nova', description: 'Energetic and bright', provider: 'openai' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft and gentle', provider: 'openai' },
];

export function VoiceSelector({
  value,
  onChange,
  onPreview,
  className,
}: VoiceSelectorProps) {
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Voice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Load ElevenLabs voices when that provider is selected
  useEffect(() => {
    if (value.provider === 'elevenlabs' && elevenLabsVoices.length === 0) {
      loadElevenLabsVoices();
    }
  }, [value.provider]);
  
  const loadElevenLabsVoices = async () => {
    setIsLoadingVoices(true);
    setVoiceError(null);
    
    try {
      const response = await fetch('/api/voices/elevenlabs');
      if (!response.ok) throw new Error('Failed to load voices');
      
      const data = await response.json();
      setElevenLabsVoices(data.voices.map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        description: v.description || 'Custom voice',
        provider: 'elevenlabs' as const,
      })));
      
      // Auto-select first voice if none selected
      if (!value.voice_id && data.voices.length > 0) {
        onChange({
          ...value,
          voice_id: data.voices[0].voice_id,
        });
      }
    } catch (error) {
      setVoiceError('Failed to load ElevenLabs voices. Please try again.');
      console.error('Error loading voices:', error);
    } finally {
      setIsLoadingVoices(false);
    }
  };
  
  const handleProviderChange = (provider: z.infer<typeof VoiceProviderSchema>) => {
    let defaultVoiceId = '';
    
    if (provider === 'openai') {
      defaultVoiceId = 'alloy';
    } else if (provider === 'elevenlabs' && elevenLabsVoices.length > 0) {
      defaultVoiceId = elevenLabsVoices[0].id;
    }
    
    onChange({
      provider,
      voice_id: defaultVoiceId,
      settings: { speed: 1.0, pitch: 0 },
    });
  };
  
  const handleVoiceSelect = (voiceId: string) => {
    onChange({
      ...value,
      voice_id: voiceId,
    });
  };
  
  const handleSpeedChange = (speed: number) => {
    onChange({
      ...value,
      settings: {
        ...value.settings,
        speed,
      },
    });
  };
  
  const handlePitchChange = (pitch: number) => {
    onChange({
      ...value,
      settings: {
        ...value.settings,
        pitch,
      },
    });
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm'];
    if (!validTypes.includes(file.type)) {
      setFileError('Please upload an audio file (MP3, WAV, or WebM)');
      return;
    }
    
    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setFileError('File size must be less than 50MB');
      return;
    }
    
    setFileError(null);
    setUploadedFile(file);
    onChange({
      provider: 'uploaded',
      voice_id: file.name,
      settings: {},
      file,
    });
  };
  
  const handleReset = () => {
    onChange({
      ...value,
      settings: { speed: 1.0, pitch: 0 },
    });
  };
  
  const renderVoiceCards = (voices: Voice[]) => (
    <div 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      data-testid="voice-cards-container"
    >
      {voices.map((voice) => (
        <div
          key={voice.id}
          data-voice-card
          className={cn(
            'relative p-4 rounded-lg border-2 cursor-pointer transition-all',
            'hover:shadow-md hover:border-blue-300',
            value.voice_id === voice.id
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2'
              : 'border-gray-200 bg-white'
          )}
        >
          <button
            type="button"
            onClick={() => handleVoiceSelect(voice.id)}
            className="w-full text-left"
            aria-pressed={value.voice_id === voice.id}
          >
            <div className="font-medium text-gray-900">{voice.name}</div>
            <div className="text-sm text-gray-600 mt-1">{voice.description}</div>
          </button>
          
          {onPreview && (
            <button
              type="button"
              onClick={() => onPreview(voice.provider, voice.id)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-100"
              aria-label={`Preview ${voice.name} voice`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          
          {value.voice_id === voice.id && (
            <div className="absolute top-2 right-2" data-testid="check-icon">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Provider Tabs */}
      <div 
        role="tablist"
        aria-label="Voice provider selection"
        className="flex space-x-1 rounded-lg bg-gray-100 p-1"
      >
        <button
          role="tab"
          aria-selected={value.provider === 'openai'}
          onClick={() => handleProviderChange('openai')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            value.provider === 'openai'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          OpenAI
        </button>
        
        <button
          role="tab"
          aria-selected={value.provider === 'elevenlabs'}
          onClick={() => handleProviderChange('elevenlabs')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            value.provider === 'elevenlabs'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          ElevenLabs
        </button>
        
        <button
          role="tab"
          aria-selected={value.provider === 'uploaded'}
          onClick={() => handleProviderChange('uploaded')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            value.provider === 'uploaded'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Upload
        </button>
      </div>
      
      {/* Voice Selection */}
      <div role="tabpanel">
        {value.provider === 'openai' && renderVoiceCards(OPENAI_VOICES)}
        
        {value.provider === 'elevenlabs' && (
          <>
            {isLoadingVoices && (
              <div className="text-center py-8 text-gray-500">
                Loading voices...
              </div>
            )}
            
            {voiceError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {voiceError}
                <button
                  onClick={loadElevenLabsVoices}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            )}
            
            {!isLoadingVoices && !voiceError && renderVoiceCards(elevenLabsVoices)}
          </>
        )}
        
        {value.provider === 'uploaded' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input
                type="file"
                id="voice-upload"
                accept="audio/*"
                onChange={handleFileUpload}
                className="sr-only"
              />
              <label
                htmlFor="voice-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  Choose file or drag and drop
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  Supported formats: MP3, WAV, WebM (Max 50MB)
                </span>
              </label>
            </div>
            
            {uploadedFile && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700">
                    {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      onChange({ ...value, voice_id: '', file: undefined });
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
            
            {fileError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {fileError}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Voice Controls */}
      {value.provider !== 'uploaded' && (
        <div 
          className="space-y-3 p-4 bg-gray-50 rounded-lg"
          data-testid="voice-controls"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Speed Control */}
            <div className="flex-1">
              <label 
                htmlFor="voice-speed"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Speed
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  id="voice-speed"
                  min="0.25"
                  max="4"
                  step="0.25"
                  value={value.settings?.speed || 1}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="flex-1"
                  aria-label="Voice speed"
                  aria-valuetext={`${value.settings?.speed || 1}x speed`}
                />
                <span className="text-sm font-medium text-gray-700 w-12">
                  {value.settings?.speed || 1}x
                </span>
              </div>
            </div>
            
            {/* Pitch Control (OpenAI only) */}
            {value.provider === 'openai' && (
              <div className="flex-1">
                <label 
                  htmlFor="voice-pitch"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Pitch
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    id="voice-pitch"
                    min="-2"
                    max="2"
                    step="0.5"
                    value={value.settings?.pitch || 0}
                    onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                    className="flex-1"
                    aria-label="Voice pitch"
                    aria-valuetext={value.settings?.pitch === 0 ? 'Normal pitch' : `Pitch ${value.settings?.pitch}`}
                  />
                  <span className="text-sm font-medium text-gray-700 w-12">
                    {value.settings?.pitch || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {(value.settings?.speed !== 1 || value.settings?.pitch !== 0) && (
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}
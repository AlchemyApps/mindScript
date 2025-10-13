'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../../../lib/utils';
import { ScriptEditor } from './ScriptEditor';
import { VoiceSelector } from './VoiceSelector';
import { MusicBrowser } from './MusicBrowser';
import { useAutoSave } from '../hooks/useAutoSave';

// Form schema
const builderFormSchema = z.object({
  script: z.string().min(10, 'Script must be at least 10 characters').max(5000, 'Script must be no more than 5000 characters'),
  voice: z.object({
    provider: z.enum(['openai', 'elevenlabs', 'uploaded']),
    voice_id: z.string().min(1, 'Please select a voice'),
    settings: z.object({
      speed: z.number().min(0.25).max(4.0).optional(),
      pitch: z.number().min(-2).max(2).optional(),
    }).optional(),
  }),
  music: z.object({
    id: z.string().optional(),
    volume_db: z.number().min(-20).max(0),
  }).optional(),
  solfeggio: z.object({
    enabled: z.boolean(),
    frequency: z.number().optional(),
    volume_db: z.number().min(-30).max(0),
  }).optional(),
  binaural: z.object({
    enabled: z.boolean(),
    band: z.enum(['delta', 'theta', 'alpha', 'beta', 'gamma']).optional(),
    volume_db: z.number().min(-30).max(0),
  }).optional(),
});

type BuilderFormData = z.infer<typeof builderFormSchema>;

interface BuilderFormProps {
  onSubmit: (data: BuilderFormData) => Promise<void>;
  className?: string;
}

export function BuilderForm({ onSubmit, className }: BuilderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'voice' | 'music' | 'frequencies'>('script');
  
  // Initialize form with default values
  const defaultValues: BuilderFormData = {
    script: '',
    voice: {
      provider: 'openai',
      voice_id: 'alloy',
      settings: {
        speed: 1.0,
        pitch: 0,
      },
    },
    music: {
      id: undefined,
      volume_db: -10,
    },
    solfeggio: {
      enabled: false,
      frequency: 528,
      volume_db: -16,
    },
    binaural: {
      enabled: false,
      band: 'alpha',
      volume_db: -18,
    },
  };
  
  // Auto-save hook
  const { 
    value: savedData, 
    setValue: setSavedData, 
    save: manualSave,
    clear: clearDraft,
    status: saveStatus,
    lastSaved,
  } = useAutoSave<BuilderFormData>('builder-draft', defaultValues, {
    interval: 10000, // 10 seconds
    enabled: true,
    saveOnUnmount: true,
  });
  
  // React Hook Form
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<BuilderFormData>({
    resolver: zodResolver(builderFormSchema),
    defaultValues: savedData,
  });
  
  // Watch form values for auto-save
  const formValues = watch();
  
  // Update auto-save when form changes
  useEffect(() => {
    setSavedData(formValues);
  }, [formValues, setSavedData]);
  
  // Calculate form completion percentage
  const calculateProgress = (): number => {
    let progress = 0;
    const steps = 4;
    
    if (formValues.script && formValues.script.length >= 10) progress += 100 / steps;
    if (formValues.voice?.voice_id) progress += 100 / steps;
    if (formValues.music?.id !== undefined) progress += 100 / steps;
    if (formValues.solfeggio?.enabled || formValues.binaural?.enabled) progress += 100 / steps;
    
    return Math.round(progress);
  };
  
  const progress = calculateProgress();
  
  // Handle form submission
  const handleFormSubmit = async (data: BuilderFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    
    try {
      await onSubmit(data);
      setSubmitSuccess(true);
      clearDraft(); // Clear draft after successful submission
      reset(defaultValues); // Reset form
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create audio job';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        manualSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manualSave]);
  
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  
  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn('space-y-6', className)}
      data-testid="builder-form"
    >
      {/* Progress Bar */}
      <div className="bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Form completion progress"
        />
      </div>
      
      {/* Auto-save indicator */}
      {saveStatus === 'saved' && lastSaved && (
        <div className="text-xs text-green-600">
          Draft saved {new Date(lastSaved).toLocaleTimeString()}
        </div>
      )}
      
      {/* Mobile Tab Navigation */}
      {isMobile && (
        <div 
          role="tablist"
          className="flex lg:hidden space-x-1 rounded-lg bg-gray-100 p-1"
          data-testid="step-indicators"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'script'}
            onClick={() => setActiveTab('script')}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium',
              activeTab === 'script' 
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Script
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'voice'}
            onClick={() => setActiveTab('voice')}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium',
              activeTab === 'voice' 
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Voice
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'music'}
            onClick={() => setActiveTab('music')}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium',
              activeTab === 'music' 
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Music
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'frequencies'}
            onClick={() => setActiveTab('frequencies')}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium',
              activeTab === 'frequencies' 
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Frequencies
          </button>
        </div>
      )}
      
      {/* Form Content */}
      <div 
        className={cn(
          'grid gap-6',
          isMobile ? 'grid-cols-1' : 'lg:grid-cols-[300px_1fr]'
        )}
        data-testid="builder-container"
      >
        {/* Desktop Sidebar / Mobile Content */}
        <div className={cn(isMobile && activeTab !== 'script' && 'hidden')}>
          <fieldset 
            className="space-y-4"
            data-testid="script-editor-section"
            role="group"
            aria-labelledby="script-label"
          >
            <legend id="script-label" className="text-lg font-semibold">Script</legend>
            <Controller
              name="script"
              control={control}
              render={({ field }) => (
                <>
                  <ScriptEditor
                    value={field.value}
                    onChange={field.onChange}
                    showLineNumbers={!isMobile}
                    enableMarkdownPreview={true}
                    showExample={true}
                  />
                  {errors.script && (
                    <p className="text-sm text-red-600" role="alert">
                      {errors.script.message}
                    </p>
                  )}
                </>
              )}
            />
          </fieldset>
        </div>
        
        {/* Main Content Area */}
        <div className="space-y-6">
          {/* Voice Selection */}
          <fieldset
            className={cn(isMobile && activeTab !== 'voice' && 'hidden')}
            data-testid="voice-selector-section"
            role="group"
            aria-labelledby="voice-label"
          >
            <legend id="voice-label" className="text-lg font-semibold mb-4">
              <label htmlFor="voice-provider">Voice</label>
            </legend>
            <Controller
              name="voice"
              control={control}
              render={({ field }) => (
                <>
                  <VoiceSelector
                    value={field.value}
                    onChange={field.onChange}
                  />
                  {errors.voice?.voice_id && (
                    <p className="text-sm text-red-600 mt-2" role="alert">
                      {errors.voice.voice_id.message}
                    </p>
                  )}
                </>
              )}
            />
          </fieldset>
          
          {/* Music Selection */}
          <fieldset
            className={cn(isMobile && activeTab !== 'music' && 'hidden')}
            data-testid="music-browser-section"
            role="group"
            aria-labelledby="music-label"
          >
            <legend id="music-label" className="text-lg font-semibold mb-4">
              <label htmlFor="background-music">Background Music</label>
            </legend>
            <Controller
              name="music"
              control={control}
              render={({ field }) => (
                <MusicBrowser
                  selectedTrackId={field.value?.id}
                  volume={field.value?.volume_db || -10}
                  onSelect={(id) => setValue('music.id', id)}
                  onVolumeChange={(volume) => setValue('music.volume_db', volume)}
                />
              )}
            />
          </fieldset>
          
          {/* Frequency Controls (Placeholder) */}
          <fieldset
            className={cn(isMobile && activeTab !== 'frequencies' && 'hidden')}
            data-testid="frequency-controls-section"
            role="group"
            aria-labelledby="frequency-label"
          >
            <legend id="frequency-label" className="text-lg font-semibold mb-4">
              Frequencies
            </legend>
            <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
              <p>Solfeggio and Binaural frequency controls</p>
              <p className="text-sm mt-2">Coming in next phase</p>
            </div>
          </fieldset>
        </div>
      </div>
      
      {/* Error/Success Messages */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700" role="alert">
          {submitError}
        </div>
      )}
      
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700" role="status">
          Audio job created successfully! Redirecting to your library...
        </div>
      )}
      
      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || progress < 25}
          className={cn(
            'px-6 py-3 rounded-lg font-medium transition-colors',
            isSubmitting || progress < 25
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {isSubmitting ? 'Creating...' : 'Create Audio'}
        </button>
      </div>
    </form>
  );
}
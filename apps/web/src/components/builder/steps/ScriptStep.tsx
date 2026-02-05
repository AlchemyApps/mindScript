'use client';

import { useState } from 'react';
import { Sparkles, Lightbulb, RefreshCw } from 'lucide-react';
import { Button } from '@mindscript/ui';
import { cn } from '../../../lib/utils';
import type { IntentionCategory } from './IntentionStep';

interface ScriptStepProps {
  title: string;
  script: string;
  intention: IntentionCategory | null;
  onTitleChange: (title: string) => void;
  onScriptChange: (script: string) => void;
  className?: string;
}

const EXAMPLE_SCRIPTS: Record<IntentionCategory, string> = {
  confidence:
    'I am confident and capable. Every day, I grow stronger and more resilient. I trust in my abilities and embrace new challenges with courage. Success flows to me naturally, and I am worthy of all good things.',
  sleep:
    'As I close my eyes, I release the day. My mind is calm, my body is relaxed. With each breath, I sink deeper into peace. Sleep comes easily, and I wake refreshed and restored.',
  focus:
    'My mind is clear and focused. I direct my attention with intention and purpose. Distractions fade away as I concentrate on what matters most. I am present, aware, and fully engaged.',
  abundance:
    'Abundance flows to me from all directions. I am open to receiving prosperity in all forms. Opportunities present themselves, and I recognize my worth. I am grateful for all that I have and all that is coming.',
  healing:
    'My body knows how to heal itself. I release what no longer serves me with love and gratitude. Every cell in my body vibrates with health and vitality. I am whole, I am well, I am at peace.',
  custom: '',
};

const AI_PROMPTS = [
  'Make it more personal',
  'Add gratitude',
  'Make it shorter',
  'Add visualization',
];

export function ScriptStep({
  title,
  script,
  intention,
  onTitleChange,
  onScriptChange,
  className,
}: ScriptStepProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const charCount = script.length;
  const isValidLength = charCount >= 10 && charCount <= 5000;
  const estimatedMinutes = Math.ceil(charCount / 150);

  const handleUseExample = () => {
    if (intention && EXAMPLE_SCRIPTS[intention]) {
      onScriptChange(EXAMPLE_SCRIPTS[intention]);
    }
  };

  const handleEnhanceWithAI = async (prompt?: string) => {
    if (!script.trim()) return;
    setIsEnhancing(true);

    // Simulate AI enhancement - in production this would call your API
    setTimeout(() => {
      // Add a simple transformation for demo
      const enhanced = script + '\n\nI embrace this truth with every breath.';
      onScriptChange(enhanced);
      setIsEnhancing(false);
    }, 1500);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold font-heading text-text">
          Write your affirmation
        </h2>
        <p className="text-muted">
          Craft your message or use our AI to help enhance it
        </p>
      </div>

      {/* Title Input */}
      <div className="space-y-2">
        <label htmlFor="track-title" className="block text-sm font-medium text-text">
          Track Title
        </label>
        <input
          id="track-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Morning Confidence Boost"
          className={cn(
            'w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
            'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
            'bg-white text-text placeholder:text-muted/50',
            title.length > 0 && title.length < 3
              ? 'border-error/50'
              : 'border-gray-100'
          )}
        />
        {title.length > 0 && title.length < 3 && (
          <p className="text-sm text-error">Title must be at least 3 characters</p>
        )}
      </div>

      {/* Script Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="script" className="block text-sm font-medium text-text">
            Your Script
          </label>
          {intention && intention !== 'custom' && (
            <button
              type="button"
              onClick={handleUseExample}
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              Use example
            </button>
          )}
        </div>

        <div className="relative">
          <textarea
            id="script"
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            placeholder="Write your affirmation, meditation, or motivational script here..."
            className={cn(
              'w-full h-48 md:h-64 px-4 py-3 rounded-xl border-2 resize-none transition-all duration-200',
              'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
              'bg-white text-text placeholder:text-muted/50',
              !isValidLength && charCount > 0 ? 'border-error/50' : 'border-gray-100'
            )}
          />

          {/* AI Enhancement Button */}
          {script.trim() && (
            <div className="absolute bottom-3 right-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleEnhanceWithAI()}
                disabled={isEnhancing}
                className="bg-white/90 hover:bg-white shadow-sm"
              >
                {isEnhancing ? (
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1.5 text-primary" />
                )}
                {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
              </Button>
            </div>
          )}
        </div>

        {/* Character Count & Duration */}
        <div className="flex items-center justify-between text-sm">
          <span className={cn(charCount > 0 && !isValidLength ? 'text-error' : 'text-muted')}>
            {charCount} / 5000 characters
            {charCount < 10 && charCount > 0 && ' (minimum 10)'}
          </span>
          {charCount >= 10 && (
            <span className="text-muted">
              ~{estimatedMinutes} min read
            </span>
          )}
        </div>
      </div>

      {/* AI Prompt Suggestions */}
      {script.trim() && (
        <div className="flex flex-wrap gap-2">
          {AI_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleEnhanceWithAI(prompt)}
              disabled={isEnhancing}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-all duration-200',
                'bg-white text-muted hover:text-primary hover:border-primary hover:bg-primary/5',
                isEnhancing && 'opacity-50 cursor-not-allowed'
              )}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Tips Card */}
      <div className="p-4 rounded-xl bg-soft-lavender/30 border border-soft-lavender">
        <h4 className="font-medium text-text text-sm mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          Writing Tips
        </h4>
        <ul className="text-sm text-muted space-y-1">
          <li>• Use present tense ("I am" instead of "I will be")</li>
          <li>• Keep it positive (avoid negative words)</li>
          <li>• Make it personal and specific to you</li>
          <li>• Include feelings and sensations</li>
        </ul>
      </div>
    </div>
  );
}

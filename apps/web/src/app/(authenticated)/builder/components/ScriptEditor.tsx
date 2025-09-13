'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@mindscript/ui/utils/cn';

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  showLineNumbers?: boolean;
  enableMarkdownPreview?: boolean;
  showExample?: boolean;
  className?: string;
}

const EXAMPLE_SCRIPT = `Welcome to this guided meditation. Take a moment to find a comfortable position and close your eyes.

Begin by taking a deep breath in through your nose... and slowly exhale through your mouth. Feel your body beginning to relax with each breath.

As you continue breathing naturally, imagine a warm, golden light surrounding your body. This light brings peace and tranquility to every part of your being.

With each breath, you feel more relaxed... more at peace... letting go of any tension or stress from your day.

Continue breathing deeply, knowing that you are safe, you are calm, and you are at peace.`;

export function ScriptEditor({
  value,
  onChange,
  maxLength = 5000,
  placeholder = 'Write your meditation script here...',
  showLineNumbers = false,
  enableMarkdownPreview = false,
  showExample = false,
  className,
}: ScriptEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const characterCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const lines = value.split('\n');
  const lineCount = lines.length;
  const charactersRemaining = maxLength - characterCount;
  
  const characterCountClass = useMemo(() => {
    if (characterCount >= maxLength) return 'text-red-600';
    if (characterCount >= maxLength * 0.95) return 'text-yellow-600';
    return 'text-gray-600';
  }, [characterCount, maxLength]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  }, [onChange, maxLength]);
  
  const handleUseExample = useCallback(() => {
    onChange(EXAMPLE_SCRIPT);
  }, [onChange]);
  
  const renderMarkdownPreview = () => {
    // Simple markdown rendering (in production, use a proper markdown library)
    const htmlContent = value
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
    
    return (
      <div 
        className="prose prose-sm max-w-none p-4 bg-white rounded-lg border border-gray-200 min-h-[300px]"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        role="article"
        aria-label="Markdown preview"
      />
    );
  };
  
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <label htmlFor="script-editor" className="block text-sm font-medium text-gray-700">
          Script Content
        </label>
        
        <div className="flex items-center gap-2">
          {showExample && value.length === 0 && (
            <button
              type="button"
              onClick={handleUseExample}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Use Example
            </button>
          )}
          
          {enableMarkdownPreview && (
            <button
              type="button"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="text-sm px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              {isPreviewMode ? 'Edit' : 'Preview'}
            </button>
          )}
        </div>
      </div>
      
      {/* Editor/Preview Area */}
      <div className="relative">
        {isPreviewMode ? (
          renderMarkdownPreview()
        ) : (
          <div className="relative flex">
            {/* Line Numbers */}
            {showLineNumbers && (
              <div className="select-none pr-2 py-3 text-right text-xs text-gray-400 bg-gray-50 border-r border-gray-200 rounded-l-lg">
                {lines.map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>
            )}
            
            {/* Textarea */}
            <textarea
              id="script-editor"
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              maxLength={maxLength}
              className={cn(
                'flex-1 min-h-[300px] p-3 border border-gray-300 rounded-lg',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'resize-y font-mono text-sm',
                showLineNumbers && 'rounded-l-none border-l-0'
              )}
              aria-label="Script editor"
              aria-describedby="character-count word-count"
              spellCheck="true"
            />
          </div>
        )}
      </div>
      
      {/* Footer Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-gray-500">
          <span id="word-count">{wordCount} words</span>
          <span>{lineCount} lines</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span 
            id="character-count"
            className={cn('font-medium', characterCountClass)}
          >
            {characterCount} / {maxLength}
          </span>
          
          {/* Screen reader announcement for character limit */}
          <div 
            role="status" 
            aria-live="polite" 
            aria-atomic="true"
            className="sr-only"
          >
            {charactersRemaining <= 100 && charactersRemaining > 0 && (
              <span>{charactersRemaining} characters remaining</span>
            )}
            {charactersRemaining <= 0 && (
              <span>Character limit reached</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
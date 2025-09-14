'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Info } from 'lucide-react';
import { usePublishStore, Category, Visibility } from '@/store/publishStore';
import { PublishMetadataSchema } from '@mindscript/schemas';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface MetadataFormProps {
  currentStep: number;
}

const categories: Category[] = ['Meditation', 'Sleep', 'Focus', 'Relaxation', 'Energy', 'Healing'];

const categoryTags: Record<Category, string[]> = {
  'Meditation': ['mindfulness', 'guided', 'breathing', 'calm', 'zen'],
  'Sleep': ['sleep', 'insomnia', 'bedtime', 'rest', 'dreams'],
  'Focus': ['concentration', 'productivity', 'study', 'work', 'attention'],
  'Relaxation': ['relax', 'stress-relief', 'peaceful', 'tranquil', 'soothing'],
  'Energy': ['motivation', 'energy', 'boost', 'vitality', 'awakening'],
  'Healing': ['healing', 'recovery', 'wellness', 'therapy', 'restoration'],
};

export function MetadataForm({ currentStep }: MetadataFormProps) {
  const { metadata, updateMetadata } = usePublishStore();
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Validate field
  const validateField = useCallback((field: string, value: any) => {
    try {
      const schema = PublishMetadataSchema.shape[field as keyof typeof PublishMetadataSchema.shape];
      if (schema) {
        schema.parse(value);
        setErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({
          ...prev,
          [field]: error.errors[0].message,
        }));
      }
    }
  }, []);

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateMetadata({ title: value });
    validateField('title', value);
  };

  // Handle description change
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 500) {
      updateMetadata({ description: value });
      validateField('description', value);
    }
  };

  // Handle tag addition
  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().replace(/[^a-z0-9\-]/g, '');
    
    if (!normalizedTag) {
      setErrors(prev => ({ ...prev, tags: 'Invalid tag format' }));
      return;
    }

    if (metadata.tags?.includes(normalizedTag)) {
      setErrors(prev => ({ ...prev, tags: 'Tag already added' }));
      return;
    }

    if ((metadata.tags?.length || 0) >= 10) {
      setErrors(prev => ({ ...prev, tags: 'Maximum 10 tags allowed' }));
      return;
    }

    const newTags = [...(metadata.tags || []), normalizedTag];
    updateMetadata({ tags: newTags });
    setTagInput('');
    setShowSuggestions(false);
    setErrors(prev => {
      const next = { ...prev };
      delete next.tags;
      return next;
    });
  };

  // Handle tag removal
  const removeTag = (tag: string) => {
    const newTags = metadata.tags?.filter(t => t !== tag) || [];
    updateMetadata({ tags: newTags });
  };

  // Handle tag input
  const handleTagInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagInput(value);
    
    if (value.length > 0) {
      // Get suggestions based on input
      const suggestions = Object.values(categoryTags)
        .flat()
        .filter(tag => 
          tag.startsWith(value.toLowerCase()) && 
          !metadata.tags?.includes(tag)
        )
        .slice(0, 5);
      setTagSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle tag input key press
  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        addTag(tagInput.trim());
      }
    }
  };

  // Get suggested tags based on category
  const getSuggestedTags = () => {
    if (!metadata.category) return [];
    return categoryTags[metadata.category].filter(
      tag => !metadata.tags?.includes(tag)
    );
  };

  if (currentStep === 1) {
    return (
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={metadata.title || ''}
            onChange={handleTitleChange}
            className={cn(
              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none",
              "dark:bg-gray-800 dark:border-gray-700 dark:text-white",
              errors.title && "border-red-500"
            )}
            placeholder="Enter track title..."
            maxLength={100}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">
              {metadata.title?.length || 0} / 100
            </span>
            {errors.title && (
              <span className="text-xs text-red-500">{errors.title}</span>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={metadata.description || ''}
            onChange={handleDescriptionChange}
            className={cn(
              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none",
              "dark:bg-gray-800 dark:border-gray-700 dark:text-white",
              errors.description && "border-red-500"
            )}
            placeholder="Describe your track..."
            rows={4}
            maxLength={500}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">
              {metadata.description?.length || 0} / 500
            </span>
            {errors.description && (
              <span className="text-xs text-red-500">{errors.description}</span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tags
          </label>
          <div className="relative">
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={handleTagInput}
              onKeyPress={handleTagKeyPress}
              className={cn(
                "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none",
                "dark:bg-gray-800 dark:border-gray-700 dark:text-white",
                errors.tags && "border-red-500"
              )}
              placeholder="Add tags (lowercase, alphanumeric)..."
            />
            
            {/* Tag suggestions dropdown */}
            {showSuggestions && tagSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                {tagSuggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => addTag(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {errors.tags && (
            <span className="text-xs text-red-500 mt-1">{errors.tags}</span>
          )}
          
          {/* Display current tags */}
          {metadata.tags && metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {metadata.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="ml-2 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-2">
            Tags must be lowercase alphanumeric with hyphens. Maximum 10 tags.
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Category & Settings
  return (
    <div className="space-y-6">
      {/* Category Selection */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Category *
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => updateMetadata({ category })}
              className={cn(
                "px-4 py-3 rounded-lg border-2 transition-all font-medium",
                metadata.category === category
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Visibility Settings */}
      <div>
        <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Visibility *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => updateMetadata({ visibility: 'public' })}
            className={cn(
              "px-4 py-3 rounded-lg border-2 transition-all font-medium",
              metadata.visibility === 'public'
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            )}
          >
            Public
            <p className="text-xs text-gray-500 mt-1">Visible to everyone</p>
          </button>
          
          <button
            onClick={() => updateMetadata({ visibility: 'private' })}
            className={cn(
              "px-4 py-3 rounded-lg border-2 transition-all font-medium",
              metadata.visibility === 'private'
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            )}
          >
            Private
            <p className="text-xs text-gray-500 mt-1">Only visible to you</p>
          </button>
        </div>
      </div>

      {/* Suggested Tags */}
      {metadata.category && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Suggested tags:
          </p>
          <div className="flex flex-wrap gap-2">
            {getSuggestedTags().slice(0, 5).map(tag => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-sm transition-colors"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SEO Preview */}
      {metadata.visibility === 'public' && metadata.title && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <Info className="w-4 h-4 mr-2" />
            SEO Preview
          </h3>
          <div className="space-y-1">
            <p className="text-blue-600 dark:text-blue-400 font-medium">
              {metadata.title} | MindScript
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              mindscript.app/tracks/{metadata.title?.toLowerCase().replace(/\s+/g, '-')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {metadata.description || 'No description provided'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
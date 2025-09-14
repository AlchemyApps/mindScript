'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePublishStore } from '@/store/publishStore';
import { MetadataForm } from './MetadataForm';
import { PricingConfig } from './PricingConfig';
import { PublishPreview } from './PublishPreview';
import { RenderProgress } from './RenderProgress';
import { cn } from '@/lib/utils';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackData: any; // Track data from builder
  onPublish?: () => Promise<void>;
}

const steps = [
  { id: 1, name: 'Metadata', description: 'Title and description' },
  { id: 2, name: 'Settings', description: 'Category and visibility' },
  { id: 3, name: 'Pricing', description: 'Marketplace settings' },
  { id: 4, name: 'Preview', description: 'Review before publishing' },
  { id: 5, name: 'Publish', description: 'Render and upload' },
];

export function PublishModal({ isOpen, onClose, trackData, onPublish }: PublishModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const {
    currentStep,
    nextStep,
    previousStep,
    goToStep,
    isStepValid,
    canProceed,
    saveDraft,
    setTrackData,
    reset,
  } = usePublishStore();

  // Set track data when modal opens
  useEffect(() => {
    if (isOpen && trackData) {
      setTrackData(trackData);
    }
  }, [isOpen, trackData, setTrackData]);

  // Handle close with draft save
  const handleClose = () => {
    saveDraft();
    onClose();
  };

  // Handle publish action
  const handlePublish = async () => {
    if (!onPublish) {
      nextStep(); // Go to render progress step
      return;
    }

    setIsPublishing(true);
    try {
      await onPublish();
      nextStep(); // Go to render progress step
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Publish Track
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isClickable = isCompleted || (step.id <= currentStep && isStepValid(step.id - 1));

            return (
              <button
                key={step.id}
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-lg transition-all',
                  isActive && 'active bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
                  isCompleted && !isActive && 'text-green-600 dark:text-green-400',
                  !isActive && !isCompleted && 'text-gray-400 dark:text-gray-600',
                  isClickable && !isActive && 'hover:bg-gray-100 dark:hover:bg-gray-800',
                  !isClickable && 'cursor-not-allowed opacity-50'
                )}
              >
                <span className="font-semibold">{step.id}. {step.name}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {currentStep <= 2 && <MetadataForm currentStep={currentStep} />}
          {currentStep === 3 && <PricingConfig />}
          {currentStep === 4 && <PublishPreview />}
          {currentStep === 5 && <RenderProgress />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={previousStep}
            disabled={currentStep === 1}
            className={cn(
              'px-6 py-2 rounded-lg font-medium transition-all',
              currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            )}
          >
            Back
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Save Draft
            </button>

            {currentStep < 4 && (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium transition-all',
                  canProceed()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                Next
              </button>
            )}

            {currentStep === 4 && (
              <button
                onClick={handlePublish}
                disabled={!canProceed() || isPublishing}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium transition-all',
                  canProceed() && !isPublishing
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
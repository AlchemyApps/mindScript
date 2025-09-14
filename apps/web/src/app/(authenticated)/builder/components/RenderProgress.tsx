'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';
import { usePublishStore, RenderStage } from '@/store/publishStore';
import { cn } from '@/lib/utils';

const stageInfo: Record<RenderStage, { label: string; description: string }> = {
  preparing: { label: 'Preparing', description: 'Setting up render job...' },
  tts: { label: 'Text-to-Speech', description: 'Converting script to audio...' },
  mixing: { label: 'Mixing', description: 'Combining audio layers...' },
  normalizing: { label: 'Normalizing', description: 'Optimizing audio levels...' },
  uploading: { label: 'Uploading', description: 'Saving to cloud storage...' },
  completed: { label: 'Completed', description: 'Track ready!' },
};

const stages: RenderStage[] = ['preparing', 'tts', 'mixing', 'normalizing', 'uploading', 'completed'];

export function RenderProgress() {
  const { jobId, renderProgress, renderError, updateRenderProgress } = usePublishStore();
  const [isPolling, setIsPolling] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Poll for render progress
  useEffect(() => {
    if (!jobId || renderProgress.stage === 'completed' || renderError) {
      return;
    }

    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/builder/progress/${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        
        const data = await response.json();
        updateRenderProgress({
          percentage: data.percentage,
          stage: data.stage,
          message: data.message,
          estimatedTimeRemaining: data.estimated_time_remaining,
        });

        if (data.stage === 'completed' || data.error) {
          clearInterval(pollInterval);
          setIsPolling(false);
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
        setRetryCount(prev => prev + 1);
        
        if (retryCount > 5) {
          clearInterval(pollInterval);
          setIsPolling(false);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [jobId, renderProgress.stage, renderError, updateRenderProgress, retryCount]);

  // Format time remaining
  const formatTime = (seconds?: number) => {
    if (!seconds) return 'Calculating...';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Get current stage index
  const currentStageIndex = renderProgress.stage ? stages.indexOf(renderProgress.stage) : -1;

  // Cancel render
  const handleCancel = async () => {
    if (!jobId) return;
    
    try {
      await fetch(`/api/renders/${jobId}/cancel`, { method: 'POST' });
      // Handle cancellation
    } catch (error) {
      console.error('Failed to cancel render:', error);
    }
  };

  if (renderError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Render Failed
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
          {renderError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (renderProgress.stage === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Track Published!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
          Your track has been successfully rendered and published.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/library'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Library
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall Progress
          </span>
          <span className="text-sm text-gray-500">
            {renderProgress.percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${renderProgress.percentage}%` }}
          />
        </div>
      </div>

      {/* Stage Progress */}
      <div className="space-y-4">
        {stages.map((stage, index) => {
          const isCompleted = currentStageIndex > index;
          const isActive = currentStageIndex === index;
          const isPending = currentStageIndex < index;
          const info = stageInfo[stage];

          return (
            <div
              key={stage}
              className={cn(
                "flex items-center p-4 rounded-lg border-2 transition-all",
                isCompleted && "border-green-500 bg-green-50 dark:bg-green-900/20",
                isActive && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
                isPending && "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              )}
            >
              <div className="flex-shrink-0 mr-4">
                {isCompleted && (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                )}
                {isActive && (
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                )}
                {isPending && (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
              </div>
              
              <div className="flex-grow">
                <h4 className={cn(
                  "font-medium",
                  isCompleted && "text-green-700 dark:text-green-300",
                  isActive && "text-blue-700 dark:text-blue-300",
                  isPending && "text-gray-500 dark:text-gray-400"
                )}>
                  {info.label}
                </h4>
                <p className={cn(
                  "text-sm",
                  isActive ? "text-gray-600 dark:text-gray-400" : "text-gray-500 dark:text-gray-500"
                )}>
                  {isActive ? renderProgress.message || info.description : info.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Info */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Estimated time remaining:
            </span>
            <span className="ml-2 font-medium text-gray-900 dark:text-white">
              {formatTime(renderProgress.estimatedTimeRemaining)}
            </span>
          </div>
          
          {isPolling && (
            <div className="flex items-center text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
              Updating...
            </div>
          )}
        </div>
      </div>

      {/* Info Message */}
      <div className="flex items-start p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium mb-1">Processing your track</p>
          <p>
            This usually takes 2-5 minutes depending on the length of your script and selected options.
            You can safely close this window - we'll send you an email when it's ready.
          </p>
        </div>
      </div>

      {/* Cancel Button */}
      {renderProgress.stage !== 'completed' && renderProgress.stage !== 'uploading' && (
        <div className="flex justify-center">
          <button
            onClick={handleCancel}
            className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Cancel Render
          </button>
        </div>
      )}
    </div>
  );
}
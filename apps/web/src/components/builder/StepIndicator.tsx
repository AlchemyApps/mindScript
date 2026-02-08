'use client';

import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  orientation = 'horizontal',
  onStepClick,
  className,
}: StepIndicatorProps) {
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        isVertical ? 'flex flex-col space-y-2' : 'flex items-center justify-between',
        className
      )}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = onStepClick && index <= currentStep;

        return (
          <div
            key={step.id}
            className={cn(
              isVertical ? 'flex items-start' : 'flex flex-col items-center flex-1',
              !isVertical && index < steps.length - 1 && 'relative'
            )}
          >
            {/* Step Circle and Content */}
            <button
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={cn(
                'flex items-center',
                isVertical ? 'flex-row space-x-3' : 'flex-col space-y-2',
                isClickable && 'cursor-pointer group'
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  'relative flex items-center justify-center rounded-full transition-all duration-300',
                  isVertical ? 'w-10 h-10' : 'w-8 h-8 md:w-10 md:h-10',
                  isCompleted && 'bg-accent text-white',
                  isCurrent && 'bg-primary text-white glow-primary',
                  !isCompleted && !isCurrent && 'bg-gray-100 text-muted',
                  isClickable && !isCurrent && 'group-hover:bg-gray-200'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}

                {/* Pulse animation for current step */}
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                )}
              </div>

              {/* Label */}
              <div className={cn(isVertical ? 'pt-0.5' : 'text-center')}>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isCurrent && 'text-primary',
                    isCompleted && 'text-accent',
                    !isCompleted && !isCurrent && 'text-muted'
                  )}
                >
                  {step.label}
                </span>
                {step.description && isVertical && (
                  <p className="text-xs text-muted mt-0.5">{step.description}</p>
                )}
              </div>
            </button>

            {/* Connector Line (horizontal) */}
            {!isVertical && index < steps.length - 1 && (
              <div
                className={cn(
                  'absolute top-4 md:top-5 left-1/2 w-full h-0.5 -z-10',
                  'bg-gray-200'
                )}
              >
                <div
                  className={cn(
                    'h-full bg-accent transition-all duration-500',
                    isCompleted ? 'w-full' : 'w-0'
                  )}
                />
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}

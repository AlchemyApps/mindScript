'use client';

import { XIcon, SparklesIcon, Loader2Icon, CheckCircleIcon } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GradientProgress } from '../ui/GradientProgress';
import { cn } from '../../lib/utils';

type RenderStatus = 'creating' | 'rendering' | 'complete';

interface RenderProgressBannerProps {
  status: RenderStatus;
  onDismiss: () => void;
}

const STATUS_CONFIG = {
  creating: {
    icon: Loader2Icon,
    title: 'Creating your track...',
    description: 'Setting up your audio track with your selected voice and music.',
    hint: 'This should only take a few seconds...',
    bgClass: 'from-primary/10 to-accent/10',
    iconClass: 'text-primary animate-spin',
    progressValue: 20,
  },
  rendering: {
    icon: SparklesIcon,
    title: 'Rendering your audio...',
    description: "We're processing your TTS, background music, and audio layers.",
    hint: 'Your track will appear below once rendering is complete (usually 2-5 minutes).',
    bgClass: 'from-warm-gold/10 to-soft/10',
    iconClass: 'text-warm-gold animate-pulse',
    progressValue: 60,
  },
  complete: {
    icon: CheckCircleIcon,
    title: 'Your track is ready!',
    description: 'Rendering complete. You can now play, download, or share your track.',
    hint: null,
    bgClass: 'from-accent/10 to-calm-mint/10',
    iconClass: 'text-accent',
    progressValue: 100,
  },
};

export function RenderProgressBanner({ status, onDismiss }: RenderProgressBannerProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', `bg-gradient-to-r ${config.bgClass}`)}>
      <GlassCard hover="none" className="relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-black/10 transition-colors"
          aria-label="Dismiss"
        >
          <XIcon className="h-4 w-4 text-muted" />
        </button>

        <div className="flex items-start gap-4">
          <div className={cn(
            'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
            status === 'creating' && 'bg-primary/20',
            status === 'rendering' && 'bg-warm-gold/20',
            status === 'complete' && 'bg-accent/20'
          )}>
            <Icon className={cn('h-6 w-6', config.iconClass)} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              {config.title}
            </h3>
            <p className="text-muted text-sm mt-1">{config.description}</p>
            {config.hint && (
              <p className="text-xs text-muted/70 mt-2">{config.hint}</p>
            )}

            {/* Progress bar for creating/rendering states */}
            {status !== 'complete' && (
              <div className="mt-4">
                <GradientProgress
                  value={config.progressValue}
                  max={100}
                  size="sm"
                  animated
                  showGlow
                />
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

'use client';

import { cn } from '../../../lib/utils';
import {
  Sparkles,
  Moon,
  Target,
  Coins,
  Heart,
  Palette
} from 'lucide-react';

export type IntentionCategory =
  | 'confidence'
  | 'sleep'
  | 'focus'
  | 'abundance'
  | 'healing'
  | 'custom';

interface IntentionOption {
  id: IntentionCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  suggestion: string;
}

const INTENTION_OPTIONS: IntentionOption[] = [
  {
    id: 'confidence',
    label: 'Confidence',
    description: 'Build self-belief and inner strength',
    icon: <Sparkles className="w-6 h-6" />,
    gradient: 'from-amber-400 to-orange-500',
    suggestion: 'I am confident and capable. Every day, I grow stronger and more resilient.',
  },
  {
    id: 'sleep',
    label: 'Better Sleep',
    description: 'Calm your mind for restful nights',
    icon: <Moon className="w-6 h-6" />,
    gradient: 'from-indigo-400 to-purple-500',
    suggestion: 'My mind is calm, my body is relaxed. I drift into peaceful, restorative sleep.',
  },
  {
    id: 'focus',
    label: 'Deep Focus',
    description: 'Sharpen concentration and clarity',
    icon: <Target className="w-6 h-6" />,
    gradient: 'from-cyan-400 to-blue-500',
    suggestion: 'I am fully present and focused. My mind is clear and my thoughts are sharp.',
  },
  {
    id: 'abundance',
    label: 'Abundance',
    description: 'Attract prosperity and opportunity',
    icon: <Coins className="w-6 h-6" />,
    gradient: 'from-emerald-400 to-teal-500',
    suggestion: 'Abundance flows to me naturally. I am open to receiving all good things.',
  },
  {
    id: 'healing',
    label: 'Healing',
    description: 'Support emotional and physical wellness',
    icon: <Heart className="w-6 h-6" />,
    gradient: 'from-rose-400 to-pink-500',
    suggestion: 'My body knows how to heal itself. I release what no longer serves me.',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Write your own unique script',
    icon: <Palette className="w-6 h-6" />,
    gradient: 'from-violet-400 to-purple-500',
    suggestion: '',
  },
];

interface IntentionStepProps {
  selectedIntention: IntentionCategory | null;
  onSelect: (intention: IntentionCategory, suggestion: string) => void;
  className?: string;
}

export function IntentionStep({
  selectedIntention,
  onSelect,
  className,
}: IntentionStepProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold font-heading text-text">
          What would you like to create?
        </h2>
        <p className="text-muted">
          Choose an intention to get started with a suggested script
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {INTENTION_OPTIONS.map((option) => (
          <IntentionCard
            key={option.id}
            option={option}
            isSelected={selectedIntention === option.id}
            onSelect={() => onSelect(option.id, option.suggestion)}
          />
        ))}
      </div>
    </div>
  );
}

interface IntentionCardProps {
  option: IntentionOption;
  isSelected: boolean;
  onSelect: () => void;
}

function IntentionCard({ option, isSelected, onSelect }: IntentionCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative p-4 md:p-6 rounded-2xl text-left transition-all duration-300',
        'border-2 hover-lift focus-ring',
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50'
      )}
    >
      {/* Icon with gradient background */}
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
          'bg-gradient-to-br text-white transition-transform duration-300',
          'group-hover:scale-110',
          option.gradient
        )}
      >
        {option.icon}
      </div>

      {/* Label */}
      <h3
        className={cn(
          'font-semibold text-base md:text-lg mb-1 transition-colors',
          isSelected ? 'text-primary' : 'text-text'
        )}
      >
        {option.label}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted line-clamp-2">{option.description}</p>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}

export { INTENTION_OPTIONS };

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Play, Pause, Lock, Sparkles, Check, User, Mic, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  type VoiceMetadata,
  type VoiceGender,
  type VoiceTier,
  calculateVoiceFee,
  VOICE_PRICING_TIERS,
} from '@mindscript/schemas';
import { VoiceCloneCTA } from './VoiceCloneCTA';

interface VoicePickerProps {
  selectedVoice: VoiceMetadata | null;
  onVoiceSelect: (voice: VoiceMetadata) => void;
  isAuthenticated: boolean;
  scriptLength?: number;
  onOpenVoiceClone?: () => void;
  isFF?: boolean;
  isFirstPurchase?: boolean;
  cloneFeeCents?: number;
  className?: string;
}

type GenderFilter = 'all' | VoiceGender;

interface VoicesResponse {
  success: boolean;
  voices: VoiceMetadata[];
  voicesByTier: {
    included: VoiceMetadata[];
    premium: VoiceMetadata[];
    custom: VoiceMetadata[];
  };
  meta: {
    totalCount: number;
    includedCount: number;
    premiumCount: number;
    customCount: number;
    isAuthenticated: boolean;
  };
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getPricingLabel(scriptLength: number): string {
  if (scriptLength <= VOICE_PRICING_TIERS.short.maxChars) return 'Short script';
  if (scriptLength <= VOICE_PRICING_TIERS.medium.maxChars) return 'Medium script';
  if (scriptLength <= VOICE_PRICING_TIERS.long.maxChars) return 'Long script';
  return 'Extended script';
}

export function VoicePicker({
  selectedVoice,
  onVoiceSelect,
  isAuthenticated,
  scriptLength = 0,
  onOpenVoiceClone,
  isFF,
  isFirstPurchase = true,
  cloneFeeCents = 2900,
  className,
}: VoicePickerProps) {
  const [voices, setVoices] = useState<VoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasClonedVoice = (voices?.voicesByTier.custom.length ?? 0) > 0;

  // Fetch voices from API
  useEffect(() => {
    async function fetchVoices() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (isAuthenticated) {
          params.set('includeCustom', 'true');
        }
        const response = await fetch(`/api/voices?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch voices');
        const data: VoicesResponse = await response.json();
        setVoices(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load voices');
      } finally {
        setLoading(false);
      }
    }
    fetchVoices();
  }, [isAuthenticated]);

  // Filter voices based on search and gender
  const filteredVoicesByTier = useMemo(() => {
    if (!voices) return { included: [], premium: [], custom: [] };

    const filterVoices = (voiceList: VoiceMetadata[]) => {
      return voiceList.filter((voice) => {
        const matchesSearch =
          searchQuery === '' ||
          voice.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (voice.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        const matchesGender = genderFilter === 'all' || voice.gender === genderFilter;
        return matchesSearch && matchesGender;
      });
    };

    return {
      included: filterVoices(voices.voicesByTier.included),
      premium: filterVoices(voices.voicesByTier.premium),
      custom: filterVoices(voices.voicesByTier.custom),
    };
  }, [voices, searchQuery, genderFilter]);

  // Handle audio preview
  const handlePreview = (voice: VoiceMetadata) => {
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (!voice.previewUrl) {
      // If no preview URL, simulate with a timeout
      setPlayingVoiceId(voice.id);
      setTimeout(() => setPlayingVoiceId(null), 3000);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    audioRef.current = new Audio(voice.previewUrl);
    audioRef.current.play();
    setPlayingVoiceId(voice.id);

    audioRef.current.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  // Handle voice selection
  const handleSelect = (voice: VoiceMetadata) => {
    // Block premium voices for unauthenticated or first-time buyers
    if (voice.tier === 'premium' && (isFirstPurchase || !isAuthenticated)) {
      return;
    }
    // Block custom voices for unauthenticated users
    if (voice.tier === 'custom' && !isAuthenticated) {
      return;
    }
    onVoiceSelect(voice);
  };

  // Calculate price for premium voice
  const getPremiumPrice = () => {
    if (scriptLength === 0) return null;
    return calculateVoiceFee(scriptLength, 'premium');
  };

  const premiumPrice = getPremiumPrice();

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Loading voices...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-primary underline text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Hero CTA — top of picker, only if no clone yet */}
      {isAuthenticated && onOpenVoiceClone && (
        <VoiceCloneCTA
          variant="hero"
          hasClonedVoice={hasClonedVoice}
          isFF={isFF}
          cloneFeeCents={cloneFeeCents}
          onClick={onOpenVoiceClone}
        />
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search voices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Gender Filter */}
        <div className="flex gap-1.5 p-1 bg-gray-100/80 rounded-xl">
          {(['all', 'female', 'male', 'neutral'] as const).map((gender) => (
            <button
              key={gender}
              onClick={() => setGenderFilter(gender)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                genderFilter === gender
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted hover:text-text'
              )}
            >
              {gender === 'all' ? 'All' : gender.charAt(0).toUpperCase() + gender.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Price indicator for premium voices */}
      {premiumPrice !== null && premiumPrice > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-soft-lavender/30 text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-muted">
            Premium voices: <span className="font-medium text-text">{formatPrice(premiumPrice)}</span>
            <span className="text-xs ml-1">({getPricingLabel(scriptLength)})</span>
          </span>
        </div>
      )}

      {/* Included Voices Section */}
      {filteredVoicesByTier.included.length > 0 && (
        <VoiceSection
          title="Included Voices"
          subtitle="Free with every track"
          voices={filteredVoicesByTier.included}
          selectedVoice={selectedVoice}
          playingVoiceId={playingVoiceId}
          onSelect={handleSelect}
          onPreview={handlePreview}
          tier="included"
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* Premium Voices Section */}
      {filteredVoicesByTier.premium.length > 0 && (
        <VoiceSection
          title="Premium Voices"
          subtitle={isFirstPurchase ? 'Available after first purchase' : premiumPrice ? `+${formatPrice(premiumPrice)}` : 'Ultra-realistic'}
          voices={filteredVoicesByTier.premium}
          selectedVoice={selectedVoice}
          playingVoiceId={playingVoiceId}
          onSelect={handleSelect}
          onPreview={handlePreview}
          tier="premium"
          isAuthenticated={isAuthenticated}
          isLocked={isFirstPurchase || !isAuthenticated}
          lockMessage={!isAuthenticated ? 'Sign up to unlock premium voices' : 'Available after your first purchase'}
        />
      )}

      {/* Custom Voices Section */}
      {isAuthenticated && filteredVoicesByTier.custom.length > 0 && (
        <VoiceSection
          title="Your Voices"
          subtitle="Custom cloned voices &middot; per-track fees apply"
          voices={filteredVoicesByTier.custom}
          selectedVoice={selectedVoice}
          playingVoiceId={playingVoiceId}
          onSelect={handleSelect}
          onPreview={handlePreview}
          tier="custom"
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* "Clone Another Voice" — only for users who already have clones */}
      {isAuthenticated && hasClonedVoice && onOpenVoiceClone && (
        <button
          type="button"
          onClick={onOpenVoiceClone}
          className={cn(
            'w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed transition-all duration-300',
            'border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10',
          )}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-text block">Clone Another Voice</span>
            <span className="text-xs text-muted">
              Clone another voice with AI — ${(cloneFeeCents / 100).toFixed(0)} one-time
            </span>
          </div>
          <Sparkles className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
        </button>
      )}

      {/* Empty state */}
      {filteredVoicesByTier.included.length === 0 &&
        filteredVoicesByTier.premium.length === 0 &&
        filteredVoicesByTier.custom.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted">No voices match your search</p>
          </div>
        )}
    </div>
  );
}

interface VoiceSectionProps {
  title: string;
  subtitle: string;
  voices: VoiceMetadata[];
  selectedVoice: VoiceMetadata | null;
  playingVoiceId: string | null;
  onSelect: (voice: VoiceMetadata) => void;
  onPreview: (voice: VoiceMetadata) => void;
  tier: VoiceTier;
  isAuthenticated: boolean;
  isLocked?: boolean;
  lockMessage?: string;
}

function VoiceSection({
  title,
  subtitle,
  voices,
  selectedVoice,
  playingVoiceId,
  onSelect,
  onPreview,
  tier,
  isAuthenticated,
  isLocked: isLockedProp,
  lockMessage,
}: VoiceSectionProps) {
  const isLocked = isLockedProp ?? ((tier === 'premium' || tier === 'custom') && !isAuthenticated);
  const resolvedLockMessage = lockMessage ?? `Sign up to unlock ${tier} voices`;

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {tier === 'premium' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 text-xs font-medium text-primary">
              <Sparkles className="w-3 h-3" />
              Premium
            </span>
          )}
          {tier === 'custom' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-xs font-medium text-accent">
              <User className="w-3 h-3" />
              Custom
            </span>
          )}
        </div>
        <span className="text-xs text-muted">{subtitle}</span>
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {voices.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            isSelected={selectedVoice?.id === voice.id}
            isPlaying={playingVoiceId === voice.id}
            isLocked={isLocked}
            lockMessage={resolvedLockMessage}
            onSelect={() => onSelect(voice)}
            onPreview={() => onPreview(voice)}
          />
        ))}
      </div>

      {/* Locked notice */}
      {isLocked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-xs text-muted">
          <Lock className="w-3 h-3" />
          <span>{resolvedLockMessage}</span>
        </div>
      )}
    </div>
  );
}

interface VoiceCardProps {
  voice: VoiceMetadata;
  isSelected: boolean;
  isPlaying: boolean;
  isLocked: boolean;
  lockMessage?: string;
  onSelect: () => void;
  onPreview: () => void;
}

function VoiceCard({
  voice,
  isSelected,
  isPlaying,
  isLocked,
  lockMessage,
  onSelect,
  onPreview,
}: VoiceCardProps) {
  // Generate consistent waveform heights based on voice id
  const waveformHeights = useMemo(() => {
    const seed = voice.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 12 }, (_, i) => {
      const val = Math.sin(seed * 0.1 + i * 0.7) * 0.4 + 0.5;
      return Math.max(20, Math.min(90, val * 100));
    });
  }, [voice.id]);

  return (
    <div
      className={cn(
        'group relative rounded-xl border-2 transition-all duration-300',
        isSelected
          ? 'border-primary bg-primary/5 shadow-[0_0_20px_rgba(108,99,255,0.15)]'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md',
        isLocked && 'opacity-75'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={isLocked}
        className={cn(
          'w-full p-4 text-left',
          isLocked && 'cursor-not-allowed'
        )}
      >
        {/* Waveform visualization */}
        <div className="mb-3 flex items-end justify-center h-8 gap-0.5">
          {waveformHeights.map((height, i) => (
            <div
              key={i}
              className={cn(
                'w-1 rounded-full transition-all duration-300',
                isSelected ? 'bg-primary' : 'bg-gray-300 group-hover:bg-gray-400',
                isPlaying && 'animate-pulse'
              )}
              style={{
                height: `${height}%`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>

        {/* Voice info */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className={cn(
              'font-medium truncate',
              isSelected ? 'text-primary' : 'text-text'
            )}>
              {voice.displayName}
            </div>
            <div className="text-xs text-muted truncate mt-0.5">
              {voice.description}
            </div>
          </div>

          {/* Selected indicator */}
          {isSelected && (
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Gender tag */}
        {voice.gender && (
          <div className="mt-2">
            <span className={cn(
              'inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
              voice.gender === 'female' && 'bg-pink-50 text-pink-600',
              voice.gender === 'male' && 'bg-blue-50 text-blue-600',
              voice.gender === 'neutral' && 'bg-gray-100 text-gray-600'
            )}>
              {voice.gender}
            </span>
          </div>
        )}
      </button>

      {/* Preview button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        className={cn(
          'absolute top-2 right-2 p-2 rounded-full transition-all',
          'bg-gray-100/80 hover:bg-gray-200 text-muted hover:text-text',
          isPlaying && 'bg-primary/10 text-primary'
        )}
        aria-label={`Preview ${voice.displayName}`}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 rounded-xl bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-1 text-center px-2">
            <Lock className="w-4 h-4 text-muted" />
            <span className="text-[10px] text-muted font-medium">{lockMessage ?? 'Sign up to unlock'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

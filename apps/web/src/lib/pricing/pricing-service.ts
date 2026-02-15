import { createServiceRoleClient } from '@mindscript/auth/server'
import {
  VOICE_PRICING_TIERS,
  CUSTOM_VOICE_CREATION_FEE_CENTS,
} from '@mindscript/schemas'

const supabaseAdmin = createServiceRoleClient()

export interface VoicePricingTier {
  maxChars: number
  priceCents: number
}

export interface PricingConfig {
  // Track base prices
  baseIntroCents: number
  baseStandardCents: number
  // Addon prices
  solfeggioCents: number
  binauralCents: number
  // Edit pricing
  editFeeCents: number
  freeEditLimit: number
  // Voice clone
  voiceCloneFeeCents: number
  // Voice per-track tiers
  voicePricingTiers: {
    short: VoicePricingTier
    medium: VoicePricingTier
    long: VoicePricingTier
    extended: VoicePricingTier
  }
  // Background track pricing
  standardBgTrackCents: number
  // COGS rates (millicents per char)
  elevenLabsCostPerCharMillicents: number
  openaiTtsCostPerCharMillicents: number
}

// Fallback defaults matching current hardcoded values
const DEFAULTS: PricingConfig = {
  baseIntroCents: 99,
  baseStandardCents: 299,
  solfeggioCents: 100,
  binauralCents: 100,
  editFeeCents: 99,
  freeEditLimit: 3,
  voiceCloneFeeCents: CUSTOM_VOICE_CREATION_FEE_CENTS,
  voicePricingTiers: {
    short: { maxChars: VOICE_PRICING_TIERS.short.maxChars, priceCents: VOICE_PRICING_TIERS.short.priceCents },
    medium: { maxChars: VOICE_PRICING_TIERS.medium.maxChars, priceCents: VOICE_PRICING_TIERS.medium.priceCents },
    long: { maxChars: VOICE_PRICING_TIERS.long.maxChars, priceCents: VOICE_PRICING_TIERS.long.priceCents },
    extended: { maxChars: VOICE_PRICING_TIERS.extended.maxChars, priceCents: VOICE_PRICING_TIERS.extended.priceCents },
  },
  standardBgTrackCents: 99,
  elevenLabsCostPerCharMillicents: 30,
  openaiTtsCostPerCharMillicents: 1.5,
}

// In-memory cache
let cached: PricingConfig | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000 // 60 seconds

/**
 * Fetch ALL pricing config from pricing_configurations + admin_settings.
 * 60s in-memory cache, falls back to hardcoded defaults if DB fails.
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  const now = Date.now()
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached
  }

  try {
    const [pricingResult, settingsResult] = await Promise.all([
      supabaseAdmin
        .from('pricing_configurations')
        .select('key, value')
        .eq('is_active', true),
      supabaseAdmin
        .from('admin_settings')
        .select('key, value')
        .in('key', ['edit_fee_cents', 'free_edit_limit']),
    ])

    const pMap = new Map<string, number>()
    for (const row of pricingResult.data || []) {
      pMap.set(row.key, Number(row.value))
    }

    const sMap = new Map<string, number>()
    for (const row of settingsResult.data || []) {
      sMap.set(row.key, Number(row.value))
    }

    const config: PricingConfig = {
      baseIntroCents: pMap.get('base_intro_web_cents') ?? DEFAULTS.baseIntroCents,
      baseStandardCents: pMap.get('base_standard_web_cents') ?? DEFAULTS.baseStandardCents,
      solfeggioCents: pMap.get('solfeggio_cents') ?? DEFAULTS.solfeggioCents,
      binauralCents: pMap.get('binaural_cents') ?? DEFAULTS.binauralCents,
      editFeeCents: sMap.get('edit_fee_cents') ?? DEFAULTS.editFeeCents,
      freeEditLimit: sMap.get('free_edit_limit') ?? DEFAULTS.freeEditLimit,
      voiceCloneFeeCents: pMap.get('voice_clone_fee_cents') ?? DEFAULTS.voiceCloneFeeCents,
      voicePricingTiers: {
        short: {
          maxChars: pMap.get('premium_voice_short_max_chars') ?? DEFAULTS.voicePricingTiers.short.maxChars,
          priceCents: pMap.get('premium_voice_short_cents') ?? DEFAULTS.voicePricingTiers.short.priceCents,
        },
        medium: {
          maxChars: pMap.get('premium_voice_medium_max_chars') ?? DEFAULTS.voicePricingTiers.medium.maxChars,
          priceCents: pMap.get('premium_voice_medium_cents') ?? DEFAULTS.voicePricingTiers.medium.priceCents,
        },
        long: {
          maxChars: pMap.get('premium_voice_long_max_chars') ?? DEFAULTS.voicePricingTiers.long.maxChars,
          priceCents: pMap.get('premium_voice_long_cents') ?? DEFAULTS.voicePricingTiers.long.priceCents,
        },
        extended: {
          maxChars: pMap.get('premium_voice_extended_max_chars') ?? DEFAULTS.voicePricingTiers.extended.maxChars,
          priceCents: pMap.get('premium_voice_extended_cents') ?? DEFAULTS.voicePricingTiers.extended.priceCents,
        },
      },
      standardBgTrackCents: pMap.get('standard_bg_track_cents') ?? DEFAULTS.standardBgTrackCents,
      elevenLabsCostPerCharMillicents: pMap.get('elevenlabs_cost_per_char_millicents') ?? DEFAULTS.elevenLabsCostPerCharMillicents,
      openaiTtsCostPerCharMillicents: pMap.get('openai_tts_cost_per_char_millicents') ?? DEFAULTS.openaiTtsCostPerCharMillicents,
    }

    cached = config
    cachedAt = now
    return config
  } catch (error) {
    console.error('[PRICING-SERVICE] Failed to fetch pricing config, using defaults:', error)
    return DEFAULTS
  }
}

/**
 * Calculate voice fee using dynamic tiers from the pricing config.
 */
export function calculateDynamicVoiceFee(
  scriptLength: number,
  tier: 'included' | 'premium' | 'custom',
  tiers: PricingConfig['voicePricingTiers'],
): number {
  if (tier === 'included') return 0

  if (scriptLength <= tiers.short.maxChars) return tiers.short.priceCents
  if (scriptLength <= tiers.medium.maxChars) return tiers.medium.priceCents
  if (scriptLength <= tiers.long.maxChars) return tiers.long.priceCents
  return tiers.extended.priceCents
}

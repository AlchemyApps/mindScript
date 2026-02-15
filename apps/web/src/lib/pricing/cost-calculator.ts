/**
 * Default AI cost rates for COGS calculation.
 * These are fallbacks — prefer passing dynamic rates from getPricingConfig().
 */
const DEFAULT_ELEVENLABS_COST_PER_CHAR = 0.0003  // ~$0.30/1K chars (Creator plan)
const DEFAULT_OPENAI_TTS_COST_PER_CHAR = 0.000015 // ~$15/1M chars

export interface CogsRates {
  elevenLabsCostPerCharMillicents: number
  openaiTtsCostPerCharMillicents: number
}

export interface TrackCostInput {
  scriptLength: number
  voiceProvider: 'openai' | 'elevenlabs' | 'uploaded' | string
  cogsRates?: CogsRates
}

export interface CostBreakdown {
  ttsCents: number
  totalCents: number
}

/**
 * Calculate the AI generation cost (COGS) for a new track.
 * Background music, solfeggio, binaural, and rendering are all $0 COGS.
 * Pass cogsRates from getPricingConfig() for admin-controlled dynamic rates.
 */
export function calculateAICost(input: TrackCostInput): CostBreakdown {
  const { scriptLength, voiceProvider, cogsRates } = input

  if (scriptLength <= 0 || voiceProvider === 'uploaded') {
    return { ttsCents: 0, totalCents: 0 }
  }

  // Convert millicents to per-char dollar cost: millicents / 100_000
  const elCostPerChar = cogsRates
    ? cogsRates.elevenLabsCostPerCharMillicents / 100_000
    : DEFAULT_ELEVENLABS_COST_PER_CHAR
  const oaiCostPerChar = cogsRates
    ? cogsRates.openaiTtsCostPerCharMillicents / 100_000
    : DEFAULT_OPENAI_TTS_COST_PER_CHAR

  let ttsCents = 0

  switch (voiceProvider) {
    case 'elevenlabs':
      ttsCents = Math.ceil(scriptLength * elCostPerChar * 100)
      break
    case 'openai':
      ttsCents = Math.ceil(scriptLength * oaiCostPerChar * 100)
      break
    default:
      ttsCents = 0
  }

  return { ttsCents, totalCents: ttsCents }
}

/**
 * Calculate edit COGS — only non-zero if TTS needs to be re-rendered.
 * Volume-only edits require no TTS so COGS = 0.
 */
export function calculateEditCost(input: {
  requiresNewTTS: boolean
  scriptLength: number
  voiceProvider: string
}): number {
  if (!input.requiresNewTTS) return 0
  return calculateAICost({
    scriptLength: input.scriptLength,
    voiceProvider: input.voiceProvider,
  }).totalCents
}

/**
 * AI cost rates for COGS calculation.
 * These represent our actual per-character costs from providers.
 * Could be moved to admin_settings later for dynamic updates.
 */
const ELEVENLABS_COST_PER_CHAR = 0.0003  // ~$0.30/1K chars (Creator plan)
const OPENAI_TTS_COST_PER_CHAR = 0.000015 // ~$15/1M chars
const ELEVENLABS_CLONE_API_COST = 0       // Covered by plan subscription

export interface TrackCostInput {
  scriptLength: number
  voiceProvider: 'openai' | 'elevenlabs' | 'uploaded' | string
}

export interface CostBreakdown {
  ttsCents: number
  totalCents: number
}

/**
 * Calculate the AI generation cost (COGS) for a new track.
 * Background music, solfeggio, binaural, and rendering are all $0 COGS.
 */
export function calculateAICost(input: TrackCostInput): CostBreakdown {
  const { scriptLength, voiceProvider } = input

  if (scriptLength <= 0 || voiceProvider === 'uploaded') {
    return { ttsCents: 0, totalCents: 0 }
  }

  let ttsCents = 0

  switch (voiceProvider) {
    case 'elevenlabs':
      ttsCents = Math.ceil(scriptLength * ELEVENLABS_COST_PER_CHAR * 100)
      break
    case 'openai':
      ttsCents = Math.ceil(scriptLength * OPENAI_TTS_COST_PER_CHAR * 100)
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

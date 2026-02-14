import { describe, it, expect } from 'vitest'
import { calculateAICost, calculateEditCost } from './cost-calculator'

describe('calculateAICost', () => {
  it('returns 0 for uploaded voice', () => {
    const result = calculateAICost({ scriptLength: 5000, voiceProvider: 'uploaded' })
    expect(result.ttsCents).toBe(0)
    expect(result.totalCents).toBe(0)
  })

  it('returns 0 for empty script', () => {
    const result = calculateAICost({ scriptLength: 0, voiceProvider: 'elevenlabs' })
    expect(result.ttsCents).toBe(0)
    expect(result.totalCents).toBe(0)
  })

  it('calculates ElevenLabs cost correctly', () => {
    // 1000 chars * 0.0003 $/char = $0.30 = 30 cents
    const result = calculateAICost({ scriptLength: 1000, voiceProvider: 'elevenlabs' })
    expect(result.ttsCents).toBe(30)
    expect(result.totalCents).toBe(30)
  })

  it('calculates OpenAI cost correctly', () => {
    // 1000 chars * 0.000015 $/char = $0.015 = 1.5 cents -> ceil = 2
    const result = calculateAICost({ scriptLength: 1000, voiceProvider: 'openai' })
    expect(result.ttsCents).toBe(2)
    expect(result.totalCents).toBe(2)
  })

  it('rounds up to next cent (ElevenLabs)', () => {
    // 1 char * 0.0003 * 100 = 0.03 -> ceil = 1
    const result = calculateAICost({ scriptLength: 1, voiceProvider: 'elevenlabs' })
    expect(result.ttsCents).toBe(1)
  })

  it('handles typical meditation script (5000 chars, ElevenLabs)', () => {
    // 5000 * 0.0003 * 100 = 150 cents = $1.50
    const result = calculateAICost({ scriptLength: 5000, voiceProvider: 'elevenlabs' })
    expect(result.ttsCents).toBe(150)
  })

  it('handles unknown voice provider as 0', () => {
    const result = calculateAICost({ scriptLength: 1000, voiceProvider: 'some_future_provider' })
    expect(result.ttsCents).toBe(0)
  })
})

describe('calculateEditCost', () => {
  it('returns 0 when TTS not needed (volume-only edit)', () => {
    const cost = calculateEditCost({
      requiresNewTTS: false,
      scriptLength: 5000,
      voiceProvider: 'elevenlabs',
    })
    expect(cost).toBe(0)
  })

  it('returns TTS cost when new render is needed', () => {
    const cost = calculateEditCost({
      requiresNewTTS: true,
      scriptLength: 1000,
      voiceProvider: 'elevenlabs',
    })
    expect(cost).toBe(30)
  })

  it('returns 0 for uploaded voice even with new TTS flag', () => {
    const cost = calculateEditCost({
      requiresNewTTS: true,
      scriptLength: 1000,
      voiceProvider: 'uploaded',
    })
    expect(cost).toBe(0)
  })
})

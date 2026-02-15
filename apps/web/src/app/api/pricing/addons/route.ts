import { NextResponse } from 'next/server'
import { getPricingConfig } from '../../../../lib/pricing/pricing-service'

export async function GET() {
  try {
    // Use centralized pricing service (service-role, bypasses RLS)
    const pricingConfig = await getPricingConfig()

    return NextResponse.json({
      solfeggio_cents: pricingConfig.solfeggioCents,
      binaural_cents: pricingConfig.binauralCents,
    })
  } catch (error) {
    console.error('Error fetching addon pricing:', error)
    return NextResponse.json({
      solfeggio_cents: 100,
      binaural_cents: 100,
    })
  }
}

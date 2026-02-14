import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: pricingRows } = await supabase
      .from('pricing_configurations')
      .select('key, value')
      .in('key', ['solfeggio_cents', 'binaural_cents'])
      .eq('is_active', true)

    const pricingMap = new Map(
      (pricingRows || []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)])
    )

    return NextResponse.json({
      solfeggio_cents: pricingMap.get('solfeggio_cents') ?? 100,
      binaural_cents: pricingMap.get('binaural_cents') ?? 100,
    })
  } catch (error) {
    console.error('Error fetching addon pricing:', error)
    return NextResponse.json({
      solfeggio_cents: 100,
      binaural_cents: 100,
    })
  }
}

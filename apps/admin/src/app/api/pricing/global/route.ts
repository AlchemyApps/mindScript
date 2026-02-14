import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch from pricing_configurations
    const { data: pricingConfigs, error: pricingError } = await supabase
      .from('pricing_configurations')
      .select('key, value')
      .in('key', [
        'base_intro_web_cents',
        'base_standard_web_cents',
        'solfeggio_cents',
        'binaural_cents',
      ])
      .eq('is_active', true)

    if (pricingError) throw pricingError

    // Fetch from admin_settings
    const { data: adminSettings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['edit_fee_cents', 'free_edit_limit'])

    if (settingsError) throw settingsError

    const configMap = new Map<string, number>()
    for (const row of pricingConfigs || []) {
      configMap.set(row.key, typeof row.value === 'number' ? row.value : Number(row.value))
    }
    for (const row of adminSettings || []) {
      configMap.set(row.key, typeof row.value === 'number' ? row.value : Number(row.value))
    }

    return NextResponse.json({
      first_track_cents: configMap.get('base_intro_web_cents') ?? 100,
      standard_track_cents: configMap.get('base_standard_web_cents') ?? 300,
      solfeggio_cents: configMap.get('solfeggio_cents') ?? 100,
      binaural_cents: configMap.get('binaural_cents') ?? 100,
      edit_fee_cents: configMap.get('edit_fee_cents') ?? 99,
      free_edit_limit: configMap.get('free_edit_limit') ?? 3,
    })
  } catch (error) {
    console.error('Failed to fetch global pricing:', error)
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()

    // Map of field name -> { table, key }
    const fieldMapping: Record<string, { table: string; key: string }> = {
      first_track_cents: { table: 'pricing_configurations', key: 'base_intro_web_cents' },
      standard_track_cents: { table: 'pricing_configurations', key: 'base_standard_web_cents' },
      solfeggio_cents: { table: 'pricing_configurations', key: 'solfeggio_cents' },
      binaural_cents: { table: 'pricing_configurations', key: 'binaural_cents' },
      edit_fee_cents: { table: 'admin_settings', key: 'edit_fee_cents' },
      free_edit_limit: { table: 'admin_settings', key: 'free_edit_limit' },
    }

    const updates: Promise<void>[] = []

    for (const [field, value] of Object.entries(body)) {
      const mapping = fieldMapping[field]
      if (!mapping) continue

      const numValue = Number(value)
      if (Number.isNaN(numValue) || numValue < 0) continue

      if (mapping.table === 'pricing_configurations') {
        const p = supabase
          .from('pricing_configurations')
          .update({ value: numValue, updated_at: new Date().toISOString() })
          .eq('key', mapping.key)
          .then(({ error }: { error: Error | null }) => { if (error) throw error })
        updates.push(Promise.resolve(p))
      } else {
        const p = supabase
          .from('admin_settings')
          .update({ value: numValue })
          .eq('key', mapping.key)
          .then(({ error }: { error: Error | null }) => { if (error) throw error })
        updates.push(Promise.resolve(p))
      }
    }

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update global pricing:', error)
    return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SellerRow = {
  id: string
  user_id: string
  status: string
  country: string | null
  stripe_connect_account_id: string | null
  charges_enabled: boolean
  payouts_enabled: boolean
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
  profiles?: {
    email?: string | null
    full_name?: string | null
    display_name?: string | null
  } | null
}

async function ensureAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase }
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, error } = await ensureAdmin()
    if (error) return error

    const { data: sellerRows, error: sellerError } = await supabase
      .from('seller_agreements')
      .select(
        `
        id,
        user_id,
        status,
        country,
        stripe_connect_account_id,
        charges_enabled,
        payouts_enabled,
        onboarding_completed_at,
        created_at,
        updated_at,
        profiles:profiles!seller_agreements_user_id_fkey (
          email,
          full_name,
          display_name
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(200)

    if (sellerError || !sellerRows) {
      console.error('Failed to fetch sellers:', sellerError)
      return NextResponse.json({ error: 'Failed to fetch sellers' }, { status: 500 })
    }

    const userIds = sellerRows.map((row) => row.user_id)
    const earningsMap = new Map<
      string,
      {
        total_earnings_cents: number
        pending_payout_cents: number
        completed_payouts_cents: number
      }
    >()

    await Promise.all(
      userIds.map(async (sellerId) => {
        const { data, error: earningsError } = await supabase.rpc('get_seller_earnings_summary', {
          p_seller_id: sellerId,
        })

        if (earningsError) {
          console.error(`Earnings summary failed for seller ${sellerId}:`, earningsError)
          return
        }

        if (data && data[0]) {
          earningsMap.set(sellerId, {
            total_earnings_cents: Number(data[0].total_earnings_cents ?? 0),
            pending_payout_cents: Number(data[0].pending_payout_cents ?? 0),
            completed_payouts_cents: Number(data[0].completed_payouts_cents ?? 0),
          })
        }
      })
    )

    const payoutsMap = new Map<
      string,
      {
        amount_cents: number
        status: string
        completed_at: string | null
      }
    >()

    if (userIds.length) {
      const { data: payoutRows, error: payoutError } = await supabase
        .from('payouts')
        .select('seller_id, amount_cents, status, completed_at')
        .in('seller_id', userIds)
        .order('completed_at', { ascending: false })

      if (payoutError) {
        console.error('Failed to fetch payouts:', payoutError)
      } else {
        for (const payout of payoutRows || []) {
          if (!payoutsMap.has(payout.seller_id)) {
            payoutsMap.set(payout.seller_id, {
              amount_cents: payout.amount_cents,
              status: payout.status,
              completed_at: payout.completed_at,
            })
          }
        }
      }
    }

    let totalRevenue = 0
    let active = 0
    let pending = 0
    let suspended = 0

    const sellers = sellerRows.map((row: any) => {
      const summary = earningsMap.get(row.user_id)
      const normalizedStatus =
        row.status === 'pending_onboarding' || row.status === 'onboarding_incomplete'
          ? 'pending'
          : row.status

      if (normalizedStatus === 'active') active += 1
      if (normalizedStatus === 'pending') pending += 1
      if (normalizedStatus === 'suspended') suspended += 1

      totalRevenue += summary?.total_earnings_cents ?? 0

      return {
        id: row.id,
        user_id: row.user_id,
        status: row.status,
        country: row.country,
        stripe_connect_account_id: row.stripe_connect_account_id,
        charges_enabled: row.charges_enabled,
        payouts_enabled: row.payouts_enabled,
        onboarding_completed_at: row.onboarding_completed_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        profile: {
          email: row.profiles?.email ?? null,
          full_name: row.profiles?.full_name ?? null,
          display_name: row.profiles?.display_name ?? null,
        },
        earnings: {
          total_cents: summary?.total_earnings_cents ?? 0,
          pending_cents: summary?.pending_payout_cents ?? 0,
          paid_cents: summary?.completed_payouts_cents ?? 0,
        },
        latest_payout: payoutsMap.get(row.user_id) ?? null,
      }
    })

    const metrics: SellerMetrics = {
      total: sellers.length,
      active,
      pending,
      suspended,
      totalRevenue,
    }

    return NextResponse.json({ sellers, metrics })
  } catch (err) {
    console.error('Unexpected error in GET /api/sellers:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type SellerMetrics = {
  total: number
  active: number
  pending: number
  suspended: number
  totalRevenue: number
}

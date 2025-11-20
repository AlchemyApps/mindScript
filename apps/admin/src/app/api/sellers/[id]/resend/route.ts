import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

async function ensureAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { supabase, user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, user }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, user, error } = await ensureAdmin()
    if (error) return error

    // Fetch seller agreement
    const { data: agreement, error: agreementError } = await supabase
      .from('seller_agreements')
      .select('id, user_id, stripe_connect_account_id')
      .eq('id', params.id)
      .single()

    if (agreementError || !agreement) {
      console.error('Seller agreement not found:', params.id, agreementError)
      return NextResponse.json(
        { error: 'Seller agreement not found' },
        { status: 404 }
      )
    }

    if (!agreement.stripe_connect_account_id) {
      console.error('No Stripe Connect account linked for seller agreement:', params.id)
      return NextResponse.json(
        { error: 'No Stripe Connect account linked to this seller' },
        { status: 404 }
      )
    }

    // Create Stripe account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: agreement.stripe_connect_account_id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/sellers?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/sellers?onboarding=complete`,
      type: 'account_onboarding',
    })

    // Log admin action to activity log
    const forwardedFor = req.headers.get('x-forwarded-for')
    const ipAddress =
      forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
    const userAgent = req.headers.get('user-agent') || null

    const { error: logError } = await supabase.from('admin_activity_log').insert({
      admin_id: user!.id,
      action: 'resend_onboarding',
      entity_type: 'seller_agreement',
      entity_id: agreement.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        stripe_account_id: agreement.stripe_connect_account_id,
        seller_user_id: agreement.user_id,
      },
    })

    if (logError) {
      console.error('Failed to write admin activity log entry:', logError)
      return NextResponse.json(
        { error: 'Failed to record admin activity' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      onboardingUrl: accountLink.url,
      message: 'Onboarding link generated successfully',
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/sellers/[id]/resend:', err)

    // Provide more specific error message for Stripe errors
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: 'Failed to generate onboarding link', details: err.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

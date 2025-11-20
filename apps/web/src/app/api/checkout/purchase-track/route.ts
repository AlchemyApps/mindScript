import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await serverSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const trackId = body?.trackId

    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 })
    }

    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('id, title, price_cents, user_id, slug, is_public, status')
      .eq('id', trackId)
      .single()

    if (trackError || !track || !track.is_public || track.status !== 'published') {
      return NextResponse.json({ error: 'Track not available for purchase' }, { status: 404 })
    }

    if (!track.price_cents || track.price_cents <= 0) {
      return NextResponse.json({ error: 'Track cannot be purchased' }, { status: 400 })
    }

    const { data: owner } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', track.user_id)
      .single()

    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: track.title,
            description: `Track by ${owner?.display_name || owner?.username || 'seller'}`,
          },
          unit_amount: track.price_cents,
        },
        quantity: 1,
      },
    ]

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email!,
      line_items: lineItems,
      metadata: {
        type: 'track_purchase',
        track_id: track.id,
        seller_id: track.user_id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?trackId=${track.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/u/${owner?.username ?? ''}/${track.slug}`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Track purchase checkout failed:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}

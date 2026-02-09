import { NextRequest, NextResponse } from 'next/server'
import { render } from '@react-email/render'
import { createClient } from '@/lib/supabase/server'

// Import templates from main package entry point
import {
  WelcomeEmail,
  PurchaseConfirmationEmail,
  RenderCompleteEmail,
  PasswordResetEmail,
  SellerPayoutEmail,
  ModerationEmail,
} from '@mindscript/email'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is admin (only admins can preview emails)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const template = searchParams.get('template')

    if (!template) {
      return NextResponse.json(
        { error: 'Template parameter required' },
        { status: 400 }
      )
    }

    // Generate preview data for each template
    const previewData = {
      welcome: {
        firstName: 'John',
        verificationUrl: 'https://mindscript.app/verify?token=sample-token',
        loginUrl: 'https://mindscript.app/login'
      },
      'purchase-confirmation': {
        customerName: 'Jane Doe',
        trackTitle: 'Deep Relaxation Journey',
        sellerName: 'Meditation Master',
        amount: '$3.00',
        currency: 'USD',
        purchaseId: 'purchase_sample_123',
        downloadUrl: 'https://mindscript.app/download/sample',
        receiptUrl: 'https://mindscript.app/receipt/sample'
      },
      'render-complete': {
        trackTitle: 'Morning Meditation',
        downloadUrl: 'https://mindscript.app/download/sample',
        shareUrl: 'https://mindscript.app/share/sample',
        duration: '15:30',
        customerName: 'Sarah Johnson'
      },
      'password-reset': {
        resetUrl: 'https://mindscript.app/reset-password?token=sample-token',
        userEmail: 'user@example.com',
        expiresIn: '1 hour'
      },
      'seller-payout': {
        sellerName: 'Top Creator',
        payoutAmount: '$247.50',
        currency: 'USD',
        payoutDate: new Date().toLocaleDateString(),
        salesCount: 35,
        payoutId: 'payout_sample_456',
        dashboardUrl: 'https://mindscript.app/seller/dashboard'
      },
      moderation: {
        contentTitle: 'Stress Relief Meditation',
        action: (searchParams.get('action') || 'approved') as any,
        reason: 'Content contains copyrighted background music',
        appealUrl: 'https://mindscript.app/appeal/sample',
        moderatorNotes: 'Please replace the background music with royalty-free alternatives'
      }
    }

    let html = ''

    // Render template based on type
    switch (template) {
      case 'welcome':
        html = await render(
          WelcomeEmail(previewData.welcome)
        )
        break

      case 'purchase-confirmation':
        html = await render(
          PurchaseConfirmationEmail(previewData['purchase-confirmation'])
        )
        break

      case 'render-complete':
        html = await render(
          RenderCompleteEmail(previewData['render-complete'])
        )
        break

      case 'password-reset':
        html = await render(
          PasswordResetEmail(previewData['password-reset'])
        )
        break

      case 'seller-payout':
        html = await render(
          SellerPayoutEmail(previewData['seller-payout'])
        )
        break

      case 'moderation':
        html = await render(
          ModerationEmail(previewData.moderation)
        )
        break

      default:
        return NextResponse.json(
          { error: `Unknown template: ${template}` },
          { status: 400 }
        )
    }

    // Return HTML response for preview
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    console.error('Error generating email preview:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// List available templates
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const templates = [
      {
        id: 'welcome',
        name: 'Welcome Email',
        description: 'Sent to new users after registration',
        previewUrl: '/api/email/preview?template=welcome'
      },
      {
        id: 'purchase-confirmation',
        name: 'Purchase Confirmation',
        description: 'Sent after successful purchase',
        previewUrl: '/api/email/preview?template=purchase-confirmation'
      },
      {
        id: 'render-complete',
        name: 'Render Complete',
        description: 'Sent when audio rendering is complete',
        previewUrl: '/api/email/preview?template=render-complete'
      },
      {
        id: 'password-reset',
        name: 'Password Reset',
        description: 'Password reset request',
        previewUrl: '/api/email/preview?template=password-reset'
      },
      {
        id: 'seller-payout',
        name: 'Seller Payout',
        description: 'Payout notification for sellers',
        previewUrl: '/api/email/preview?template=seller-payout'
      },
      {
        id: 'moderation',
        name: 'Moderation Action',
        description: 'Content moderation notifications',
        previewUrls: {
          approved: '/api/email/preview?template=moderation&action=approved',
          rejected: '/api/email/preview?template=moderation&action=rejected',
          flagged: '/api/email/preview?template=moderation&action=flagged'
        }
      }
    ]

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error listing templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
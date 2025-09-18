import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { initEmailService } from '@mindscript/email'

// Initialize email service with Resend API key
const emailService = initEmailService(
  process.env.RESEND_API_KEY!,
  {
    fromEmail: process.env.EMAIL_FROM || 'MindScript <noreply@mindscript.app>',
    replyToEmail: process.env.EMAIL_REPLY_TO || 'support@mindscript.app',
    isDevelopment: process.env.NODE_ENV === 'development'
  }
)

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { template, to, data } = body

    // Validate input
    if (!template || !to || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: template, to, data' },
        { status: 400 }
      )
    }

    let result

    // Send email based on template type
    switch (template) {
      case 'welcome':
        result = await emailService.sendWelcome(to, data)
        break

      case 'purchase-confirmation':
        result = await emailService.sendPurchaseConfirmation(to, data)
        break

      case 'render-complete':
        result = await emailService.sendRenderComplete(to, data)
        break

      case 'password-reset':
        result = await emailService.sendPasswordReset(to, data)
        break

      case 'seller-payout':
        result = await emailService.sendSellerPayout(to, data)
        break

      case 'moderation':
        result = await emailService.sendModerationNotification(to, data)
        break

      default:
        return NextResponse.json(
          { error: `Unknown template: ${template}` },
          { status: 400 }
        )
    }

    // Log email send attempt
    await supabase.from('email_logs').insert({
      user_id: user.id,
      to_email: to,
      template,
      status: result.status,
      error: result.error,
      resend_id: result.id
    })

    if (result.status === 'failed') {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: result.id,
      status: result.status
    })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
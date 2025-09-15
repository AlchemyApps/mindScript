import { BaseProcessor } from "./base.ts"

interface EmailPayload {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  template?: string
  templateData?: Record<string, any>
  from?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: string
    contentType?: string
  }>
}

/**
 * Email processor for sending transactional emails
 */
export class EmailProcessor extends BaseProcessor {
  private resendApiKey: string

  constructor(supabase: any) {
    super(supabase)
    this.resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
  }

  async process(jobId: string, payload: EmailPayload, metadata: any): Promise<any> {
    console.log(`Processing email job ${jobId}`)

    // Validate payload
    this.validatePayload(payload, ['to', 'subject'])

    await this.updateProgress(jobId, 10, 'Validating email')

    // Normalize recipient(s)
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]

    // Prepare email data
    const emailData = await this.prepareEmailData(payload, metadata)

    await this.updateProgress(jobId, 30, 'Sending email')

    // Send email using Resend with circuit breaker
    const result = await this.withCircuitBreaker(async () => {
      return await this.sendEmail(emailData)
    })

    await this.updateProgress(jobId, 90, 'Email sent')

    // Log email send event
    await this.logEmailEvent(jobId, recipients, payload.subject, result)

    await this.updateProgress(jobId, 100, 'Completed')

    return {
      success: true,
      messageId: result.id,
      recipients,
      timestamp: new Date().toISOString(),
    }
  }

  private async prepareEmailData(payload: EmailPayload, metadata: any): Promise<any> {
    // If using a template, fetch and render it
    if (payload.template) {
      const html = await this.renderTemplate(payload.template, payload.templateData || {})
      return {
        ...payload,
        html,
        from: payload.from || 'MindScript <noreply@mindscript.app>',
      }
    }

    return {
      ...payload,
      from: payload.from || 'MindScript <noreply@mindscript.app>',
    }
  }

  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    // Email templates could be stored in the database or as static files
    // For now, we'll use simple inline templates
    const templates: Record<string, (data: any) => string> = {
      welcome: (data) => `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to MindScript!</h1>
              </div>
              <div class="content">
                <h2>Hi ${data.name || 'there'},</h2>
                <p>Thank you for joining MindScript! We're excited to have you on board.</p>
                <p>Get started by creating your first meditation track.</p>
                <a href="${data.ctaUrl || 'https://mindscript.app/builder'}" class="button">Create Your First Track</a>
                <p>If you have any questions, feel free to reach out to our support team.</p>
                <p>Best regards,<br>The MindScript Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
      trackComplete: (data) => `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .track-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Your Track is Ready!</h1>
              </div>
              <div class="content">
                <h2>Great news!</h2>
                <p>Your meditation track "${data.trackTitle}" has been successfully created.</p>
                <div class="track-info">
                  <p><strong>Duration:</strong> ${data.duration}</p>
                  <p><strong>Voice:</strong> ${data.voice}</p>
                  <p><strong>Background Music:</strong> ${data.backgroundMusic || 'None'}</p>
                </div>
                <a href="${data.downloadUrl}" class="button">Download Your Track</a>
                <p>Your track is also available in your library for streaming anytime.</p>
                <p>Happy meditating!<br>The MindScript Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
      payoutComplete: (data) => `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .payout-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .amount { font-size: 32px; color: #4CAF50; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Payout Processed!</h1>
              </div>
              <div class="content">
                <h2>Your earnings have been sent</h2>
                <div class="payout-info">
                  <p class="amount">$${data.amount}</p>
                  <p><strong>Period:</strong> ${data.period}</p>
                  <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
                  <p><strong>Method:</strong> ${data.method || 'Bank Transfer'}</p>
                </div>
                <p>The funds should arrive in your account within 2-3 business days.</p>
                <p>You can view your payout history in your seller dashboard.</p>
                <p>Thank you for being a valued creator!<br>The MindScript Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    }

    const templateFn = templates[templateName]
    if (!templateFn) {
      throw new Error(`Template not found: ${templateName}`)
    }

    return templateFn(data)
  }

  private async sendEmail(emailData: any): Promise<any> {
    if (!this.resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to send email: ${error}`)
    }

    return await response.json()
  }

  private async logEmailEvent(
    jobId: string,
    recipients: string[],
    subject: string,
    result: any
  ): Promise<void> {
    try {
      // Log to a email_logs table for audit trail
      const { error } = await this.supabase
        .from('email_logs')
        .insert({
          job_id: jobId,
          recipients,
          subject,
          message_id: result.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })

      if (error) {
        console.error('Failed to log email event:', error)
      }
    } catch (error) {
      console.error('Failed to log email event:', error)
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check if Resend API key is configured
    if (!this.resendApiKey) {
      console.error('Email processor: RESEND_API_KEY not configured')
      return false
    }

    // Could also check Resend API health endpoint if available
    return true
  }
}
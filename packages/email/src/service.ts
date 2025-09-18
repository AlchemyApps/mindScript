import { Resend } from 'resend'
import type {
  EmailOptions,
  EmailResponse,
  WelcomeEmailProps,
  PurchaseConfirmationProps,
  RenderCompleteProps,
  PasswordResetProps,
  SellerPayoutProps,
  ModerationActionProps
} from './types'

// Import templates
import { WelcomeEmail } from '../templates/welcome'
import { PurchaseConfirmationEmail } from '../templates/purchase-confirmation'
import { RenderCompleteEmail } from '../templates/render-complete'
import { PasswordResetEmail } from '../templates/password-reset'
import { SellerPayoutEmail } from '../templates/seller-payout'
import { ModerationEmail } from '../templates/moderation'

export class EmailService {
  private resend: Resend
  private fromEmail: string
  private replyToEmail: string
  private isDevelopment: boolean

  constructor(apiKey: string, options?: {
    fromEmail?: string
    replyToEmail?: string
    isDevelopment?: boolean
  }) {
    this.resend = new Resend(apiKey)
    this.fromEmail = options?.fromEmail || 'MindScript <noreply@mindscript.app>'
    this.replyToEmail = options?.replyToEmail || 'support@mindscript.app'
    this.isDevelopment = options?.isDevelopment ?? process.env.NODE_ENV === 'development'
  }

  async sendWelcome(to: string, data: WelcomeEmailProps): Promise<EmailResponse> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Welcome to MindScript! 🎵',
        react: WelcomeEmail(data),
        tags: [
          { name: 'template', value: 'welcome' },
          { name: 'user_email', value: to }
        ]
      })

      return {
        id: result.data?.id || '',
        status: 'sent'
      }
    } catch (error) {
      console.error('Failed to send welcome email:', error)
      return {
        id: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async sendPurchaseConfirmation(to: string, data: PurchaseConfirmationProps): Promise<EmailResponse> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `Your MindScript Purchase: ${data.trackTitle}`,
        react: PurchaseConfirmationEmail(data),
        tags: [
          { name: 'template', value: 'purchase-confirmation' },
          { name: 'purchase_id', value: data.purchaseId }
        ]
      })

      return {
        id: result.data?.id || '',
        status: 'sent'
      }
    } catch (error) {
      console.error('Failed to send purchase confirmation:', error)
      return {
        id: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async sendRenderComplete(to: string, data: RenderCompleteProps): Promise<EmailResponse> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `Your track "${data.trackTitle}" is ready! 🎧`,
        react: RenderCompleteEmail(data),
        tags: [
          { name: 'template', value: 'render-complete' },
          { name: 'track_title', value: data.trackTitle }
        ]
      })

      return {
        id: result.data?.id || '',
        status: 'sent'
      }
    } catch (error) {
      console.error('Failed to send render complete email:', error)
      return {
        id: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async sendPasswordReset(to: string, data: PasswordResetProps): Promise<EmailResponse> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Reset Your MindScript Password',
        react: PasswordResetEmail(data),
        tags: [
          { name: 'template', value: 'password-reset' },
          { name: 'user_email', value: to }
        ]
      })

      return {
        id: result.data?.id || '',
        status: 'sent'
      }
    } catch (error) {
      console.error('Failed to send password reset email:', error)
      return {
        id: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async sendSellerPayout(to: string, data: SellerPayoutProps): Promise<EmailResponse> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `Your MindScript payout of ${data.payoutAmount} is on the way! 💰`,
        react: SellerPayoutEmail(data),
        tags: [
          { name: 'template', value: 'seller-payout' },
          { name: 'payout_id', value: data.payoutId }
        ]
      })

      return {
        id: result.data?.id || '',
        status: 'sent'
      }
    } catch (error) {
      console.error('Failed to send seller payout email:', error)
      return {
        id: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async sendModerationNotification(to: string, data: ModerationActionProps): Promise<EmailResponse> {
    try {
      const subjectMap = {
        approved: `Your content "${data.contentTitle}" has been approved! ✅`,
        rejected: `Important: Action required for "${data.contentTitle}"`,
        flagged: `Your content "${data.contentTitle}" needs review`
      }

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: subjectMap[data.action],
        react: ModerationEmail(data),
        tags: [
          { name: 'template', value: 'moderation' },
          { name: 'action', value: data.action }
        ]
      })

      return {
        id: result.data?.id || '',
        status: 'sent'
      }
    } catch (error) {
      console.error('Failed to send moderation email:', error)
      return {
        id: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Batch send for notifications
  async sendBatch(emails: EmailOptions[]): Promise<EmailResponse[]> {
    const results: EmailResponse[] = []

    for (const email of emails) {
      try {
        const templateMap = {
          'welcome': this.sendWelcome,
          'purchase-confirmation': this.sendPurchaseConfirmation,
          'render-complete': this.sendRenderComplete,
          'password-reset': this.sendPasswordReset,
          'seller-payout': this.sendSellerPayout,
          'moderation-action': this.sendModerationNotification,
        }

        const sendFunction = templateMap[email.template]
        if (sendFunction && typeof email.to === 'string') {
          const result = await sendFunction.call(this, email.to, email.data)
          results.push(result)
        }
      } catch (error) {
        results.push({
          id: '',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  // Test mode for development
  async sendTest(template: string, to: string): Promise<EmailResponse> {
    if (!this.isDevelopment) {
      return {
        id: '',
        status: 'failed',
        error: 'Test mode is only available in development'
      }
    }

    const testData = {
      welcome: {
        firstName: 'Test User',
        verificationUrl: 'https://mindscript.app/verify?token=test',
        loginUrl: 'https://mindscript.app/login'
      },
      'purchase-confirmation': {
        customerName: 'Test User',
        trackTitle: 'Relaxation Journey',
        sellerName: 'Test Seller',
        amount: '$3.00',
        currency: 'USD',
        purchaseId: 'test_purchase_123',
        downloadUrl: 'https://mindscript.app/download/test',
        receiptUrl: 'https://mindscript.app/receipt/test'
      },
      'render-complete': {
        trackTitle: 'Morning Meditation',
        downloadUrl: 'https://mindscript.app/download/test',
        shareUrl: 'https://mindscript.app/share/test',
        duration: '10:30',
        customerName: 'Test User'
      }
    }

    const data = testData[template as keyof typeof testData]
    if (!data) {
      return {
        id: '',
        status: 'failed',
        error: 'Unknown template'
      }
    }

    // Send based on template type
    switch (template) {
      case 'welcome':
        return this.sendWelcome(to, data as WelcomeEmailProps)
      case 'purchase-confirmation':
        return this.sendPurchaseConfirmation(to, data as PurchaseConfirmationProps)
      case 'render-complete':
        return this.sendRenderComplete(to, data as RenderCompleteProps)
      default:
        return {
          id: '',
          status: 'failed',
          error: 'Template not implemented'
        }
    }
  }
}

// Singleton instance
let emailService: EmailService | null = null

export function initEmailService(apiKey: string, options?: {
  fromEmail?: string
  replyToEmail?: string
  isDevelopment?: boolean
}): EmailService {
  if (!emailService) {
    emailService = new EmailService(apiKey, options)
  }
  return emailService
}

export function getEmailService(): EmailService {
  if (!emailService) {
    throw new Error('Email service not initialized. Call initEmailService first.')
  }
  return emailService
}
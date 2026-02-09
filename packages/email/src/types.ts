export type EmailTemplate =
  | 'welcome'
  | 'purchase-confirmation'
  | 'render-complete'
  | 'password-reset'
  | 'seller-payout'
  | 'moderation-action'
  | 'subscription-renewal'
  | 'subscription-cancelled'
  | 'ff-invite'

export interface EmailOptions {
  to: string | string[]
  subject: string
  template: EmailTemplate
  data: Record<string, any>
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: EmailAttachment[]
  tags?: EmailTag[]
  scheduledAt?: Date
}

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface EmailTag {
  name: string
  value: string
}

export interface EmailResponse {
  id: string
  status: 'sent' | 'queued' | 'failed'
  error?: string
}

export interface WelcomeEmailProps {
  firstName: string
  verificationUrl?: string
  loginUrl: string
}

export interface PurchaseConfirmationProps {
  customerName: string
  trackTitle: string
  sellerName: string
  amount: string
  currency: string
  purchaseId: string
  downloadUrl: string
  receiptUrl: string
}

export interface RenderCompleteProps {
  trackTitle: string
  downloadUrl: string
  shareUrl: string
  duration: string
  customerName: string
}

export interface PasswordResetProps {
  resetUrl: string
  userEmail: string
  expiresIn: string
}

export interface SellerPayoutProps {
  sellerName: string
  payoutAmount: string
  currency: string
  payoutDate: string
  salesCount: number
  payoutId: string
  dashboardUrl: string
}

export interface ModerationActionProps {
  contentTitle: string
  action: 'approved' | 'rejected' | 'flagged'
  reason?: string
  appealUrl?: string
  moderatorNotes?: string
}

export interface FFInviteEmailProps {
  inviterName: string
  tier: 'inner_circle' | 'cost_pass'
  inviteUrl: string
  recipientEmail: string
}

export interface UnsubscribeData {
  userId: string
  email: string
  token: string
  preferences?: string[]
}
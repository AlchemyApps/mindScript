import { Resend } from 'resend'

// Email service exports
export * from './service'
export * from './types'

// Template exports
export { WelcomeEmail } from '../templates/welcome'
export { PurchaseConfirmationEmail } from '../templates/purchase-confirmation'
export { RenderCompleteEmail } from '../templates/render-complete'
export { PasswordResetEmail } from '../templates/password-reset'
export { SellerPayoutEmail } from '../templates/seller-payout'
export { ModerationEmail } from '../templates/moderation'
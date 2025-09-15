import { BaseProcessor } from "./base.ts"

interface PayoutPayload {
  sellerId: string
  period: {
    start: string
    end: string
  }
  type: 'scheduled' | 'manual' | 'instant'
  force?: boolean // Force payout even if below threshold
}

interface PayoutResult {
  sellerId: string
  amount: number
  currency: string
  transferId: string
  platformFee: number
  processingFee: number
  netAmount: number
  salesCount: number
  status: 'completed' | 'pending' | 'failed'
}

/**
 * Payout processor for handling seller payouts via Stripe Connect
 */
export class PayoutProcessor extends BaseProcessor {
  private stripeApiKey: string
  private platformFeeRate: number = 0.15 // 15% platform fee
  private minimumPayout: number = 1000 // $10.00 in cents

  constructor(supabase: any) {
    super(supabase)
    this.stripeApiKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
  }

  async process(jobId: string, payload: PayoutPayload, metadata: any): Promise<PayoutResult> {
    console.log(`Processing payout job ${jobId} for seller ${payload.sellerId}`)

    // Validate payload
    this.validatePayload(payload, ['sellerId', 'period', 'type'])

    await this.updateProgress(jobId, 10, 'Calculating earnings')

    try {
      // Get seller's Stripe Connect account
      const seller = await this.getSellerAccount(payload.sellerId)
      if (!seller.stripe_account_id) {
        throw new Error('Seller has not completed Stripe Connect onboarding')
      }

      await this.updateProgress(jobId, 20, 'Fetching sales data')

      // Calculate earnings for the period
      const earnings = await this.calculateEarnings(
        payload.sellerId,
        payload.period.start,
        payload.period.end
      )

      // Check minimum payout threshold
      if (earnings.totalAmount < this.minimumPayout && !payload.force) {
        console.log(`Payout below threshold: ${earnings.totalAmount} < ${this.minimumPayout}`)
        return {
          sellerId: payload.sellerId,
          amount: earnings.totalAmount,
          currency: 'usd',
          transferId: '',
          platformFee: 0,
          processingFee: 0,
          netAmount: 0,
          salesCount: earnings.salesCount,
          status: 'pending',
        }
      }

      await this.updateProgress(jobId, 40, 'Creating transfer')

      // Calculate fees
      const platformFee = Math.floor(earnings.totalAmount * this.platformFeeRate)
      const processingFee = 30 // Stripe's $0.30 per transfer
      const netAmount = earnings.totalAmount - platformFee - processingFee

      // Create Stripe Connect transfer
      const transfer = await this.createStripeTransfer(
        seller.stripe_account_id,
        netAmount,
        payload.sellerId,
        payload.period
      )

      await this.updateProgress(jobId, 60, 'Recording payout')

      // Record payout in database
      await this.recordPayout({
        sellerId: payload.sellerId,
        amount: earnings.totalAmount,
        platformFee,
        processingFee,
        netAmount,
        transferId: transfer.id,
        period: payload.period,
        salesIds: earnings.salesIds,
      })

      await this.updateProgress(jobId, 80, 'Updating ledger')

      // Update ledger entries
      await this.updateLedgerEntries(earnings.salesIds, transfer.id)

      // Queue payout confirmation email
      await this.queuePayoutEmail(payload.sellerId, {
        amount: netAmount / 100, // Convert to dollars for display
        period: `${payload.period.start} to ${payload.period.end}`,
        transactionId: transfer.id,
        salesCount: earnings.salesCount,
      })

      await this.updateProgress(jobId, 100, 'Payout complete')

      return {
        sellerId: payload.sellerId,
        amount: earnings.totalAmount,
        currency: 'usd',
        transferId: transfer.id,
        platformFee,
        processingFee,
        netAmount,
        salesCount: earnings.salesCount,
        status: 'completed',
      }

    } catch (error) {
      console.error(`Payout job ${jobId} failed:`, error)

      // Record failed payout attempt
      await this.recordFailedPayout(payload.sellerId, error.message)

      throw error
    }
  }

  private async getSellerAccount(sellerId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('seller_accounts')
      .select('stripe_account_id, email, business_name')
      .eq('user_id', sellerId)
      .single()

    if (error || !data) {
      throw new Error('Seller account not found')
    }

    return data
  }

  private async calculateEarnings(
    sellerId: string,
    startDate: string,
    endDate: string
  ): Promise<{ totalAmount: number; salesCount: number; salesIds: string[] }> {
    // Get unpaid sales for the period
    const { data, error } = await this.supabase
      .from('sales')
      .select('id, amount, platform_fee')
      .eq('seller_id', sellerId)
      .eq('status', 'completed')
      .is('payout_id', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`)
    }

    const salesIds = data?.map(s => s.id) || []
    const totalAmount = data?.reduce((sum, sale) => sum + (sale.amount - sale.platform_fee), 0) || 0
    const salesCount = data?.length || 0

    return { totalAmount, salesCount, salesIds }
  }

  private async createStripeTransfer(
    accountId: string,
    amount: number,
    sellerId: string,
    period: { start: string; end: string }
  ): Promise<any> {
    const response = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: amount.toString(),
        currency: 'usd',
        destination: accountId,
        description: `Payout for period ${period.start} to ${period.end}`,
        metadata: JSON.stringify({
          seller_id: sellerId,
          period_start: period.start,
          period_end: period.end,
        }),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Stripe transfer failed: ${error.error?.message || 'Unknown error'}`)
    }

    return await response.json()
  }

  private async recordPayout(payoutData: any): Promise<void> {
    const { error } = await this.supabase
      .from('payouts')
      .insert({
        seller_id: payoutData.sellerId,
        amount: payoutData.amount,
        platform_fee: payoutData.platformFee,
        processing_fee: payoutData.processingFee,
        net_amount: payoutData.netAmount,
        stripe_transfer_id: payoutData.transferId,
        period_start: payoutData.period.start,
        period_end: payoutData.period.end,
        status: 'completed',
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Failed to record payout:', error)
      // Don't throw - the transfer already succeeded
    }
  }

  private async updateLedgerEntries(salesIds: string[], transferId: string): Promise<void> {
    if (salesIds.length === 0) return

    const { error } = await this.supabase
      .from('sales')
      .update({
        payout_id: transferId,
        payout_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', salesIds)

    if (error) {
      console.error('Failed to update ledger entries:', error)
    }
  }

  private async recordFailedPayout(sellerId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from('payout_failures')
      .insert({
        seller_id: sellerId,
        error: errorMessage,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Failed to record payout failure:', error)
    }
  }

  private async queuePayoutEmail(sellerId: string, payoutDetails: any): Promise<void> {
    try {
      // Get seller details
      const { data: seller } = await this.supabase
        .from('seller_accounts')
        .select('email, business_name')
        .eq('user_id', sellerId)
        .single()

      if (seller) {
        // Queue email notification
        await this.supabase.rpc('enqueue_job', {
          p_type: 'email',
          p_payload: {
            to: seller.email,
            subject: 'Your payout has been processed',
            template: 'payoutComplete',
            templateData: {
              businessName: seller.business_name,
              ...payoutDetails,
            },
          },
          p_priority: 'normal',
          p_user_id: sellerId,
        })
      }
    } catch (error) {
      console.error('Failed to queue payout email:', error)
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check if Stripe API key is configured
    if (!this.stripeApiKey) {
      console.error('Payout processor: STRIPE_SECRET_KEY not configured')
      return false
    }

    // Could also check Stripe API connectivity
    try {
      const response = await fetch('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.stripeApiKey}`,
        },
      })

      return response.ok
    } catch (error) {
      console.error('Stripe health check failed:', error)
      return false
    }
  }
}
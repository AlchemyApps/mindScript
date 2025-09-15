import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export interface PayoutConfig {
  supabase: SupabaseClient;
  stripe: Stripe;
  minimumPayoutCents: number; // Default: 1000 ($10)
  platformFeePercent: number; // Default: 15
  holdPeriodDays: number; // Default: 7
}

export interface PayoutCalculation {
  sellerId: string;
  amountCents: number;
  currency: string;
  stripeAccountId: string;
  transactionCount: number;
  purchaseIds: string[];
  periodStart: Date;
  periodEnd: Date;
}

export interface PayoutResult {
  payoutId: string;
  sellerId: string;
  success: boolean;
  transferId?: string;
  error?: string;
}

export interface ReconciliationResult {
  success: boolean;
  discrepancies: Array<{
    payoutId: string;
    expectedAmount: number;
    actualAmount: number;
    difference: number;
  }>;
  summary: {
    totalPayouts: number;
    totalAmount: number;
    reconciledCount: number;
    discrepancyCount: number;
  };
}

/**
 * Calculates payouts for eligible sellers
 */
export class PayoutCalculator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Calculate payouts for all eligible sellers in a given period
   */
  async calculatePayouts(
    periodStart: Date,
    periodEnd: Date,
    enforceHoldPeriod = true
  ): Promise<PayoutCalculation[]> {
    // Calculate the hold period cutoff
    const holdCutoff = new Date();
    holdCutoff.setDate(holdCutoff.getDate() - 7);

    // Fetch all pending earnings for the period
    const query = this.supabase
      .from('earnings_ledger')
      .select(`
        seller_id,
        seller_earnings_cents,
        currency,
        purchase_id,
        created_at
      `)
      .eq('payout_status', 'pending')
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())
      .is('payout_id', null);

    // Apply hold period filter if enforced
    if (enforceHoldPeriod) {
      query.lte('created_at', holdCutoff.toISOString());
    }

    const { data: earnings, error } = await query;

    if (error || !earnings) {
      throw new Error(`Failed to fetch earnings: ${error?.message}`);
    }

    // Group earnings by seller and currency
    const sellerPayouts = new Map<string, PayoutCalculation>();

    for (const earning of earnings) {
      const key = `${earning.seller_id}:${earning.currency}`;

      if (!sellerPayouts.has(key)) {
        sellerPayouts.set(key, {
          sellerId: earning.seller_id,
          amountCents: 0,
          currency: earning.currency,
          stripeAccountId: '', // Will be fetched later
          transactionCount: 0,
          purchaseIds: [],
          periodStart,
          periodEnd,
        });
      }

      const payout = sellerPayouts.get(key)!;
      payout.amountCents += earning.seller_earnings_cents;
      payout.transactionCount += 1;
      payout.purchaseIds.push(earning.purchase_id);
    }

    // Filter out payouts below minimum threshold
    const eligiblePayouts: PayoutCalculation[] = [];
    const sellerIds = new Set<string>();

    for (const payout of sellerPayouts.values()) {
      if (payout.amountCents >= 1000) { // $10 minimum
        eligiblePayouts.push(payout);
        sellerIds.add(payout.sellerId);
      }
    }

    // Fetch Stripe Connect account IDs for eligible sellers
    if (sellerIds.size > 0) {
      const { data: sellers, error: sellerError } = await this.supabase
        .from('seller_agreements')
        .select('user_id, stripe_connect_account_id, charges_enabled, payouts_enabled')
        .in('user_id', Array.from(sellerIds));

      if (sellerError || !sellers) {
        throw new Error(`Failed to fetch seller agreements: ${sellerError?.message}`);
      }

      // Map Stripe account IDs to payouts
      for (const payout of eligiblePayouts) {
        const seller = sellers.find(s => s.user_id === payout.sellerId);

        if (!seller || !seller.stripe_connect_account_id) {
          throw new Error(`No Stripe account found for seller ${payout.sellerId}`);
        }

        if (!seller.charges_enabled || !seller.payouts_enabled) {
          throw new Error(`Payouts not enabled for seller ${payout.sellerId}`);
        }

        payout.stripeAccountId = seller.stripe_connect_account_id;
      }
    }

    return eligiblePayouts;
  }
}

/**
 * Processes payouts through Stripe Connect
 */
export class PayoutProcessor {
  private calculator: PayoutCalculator;

  constructor(private config: PayoutConfig) {
    this.calculator = new PayoutCalculator(config.supabase);
  }

  /**
   * Process a batch of payouts
   */
  async processPayouts(payouts: PayoutCalculation[]): Promise<PayoutResult[]> {
    const results: PayoutResult[] = [];

    for (const payout of payouts) {
      try {
        // Create payout record in database
        const { data: payoutRecord, error: dbError } = await this.config.supabase
          .from('payouts')
          .insert({
            seller_id: payout.sellerId,
            amount_cents: payout.amountCents,
            currency: payout.currency,
            status: 'processing',
            period_start: payout.periodStart.toISOString(),
            period_end: payout.periodEnd.toISOString(),
            transaction_count: payout.transactionCount,
            initiated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (dbError || !payoutRecord) {
          throw new Error(`Failed to create payout record: ${dbError?.message}`);
        }

        // Create Stripe transfer
        const transfer = await this.config.stripe.transfers.create({
          amount: payout.amountCents,
          currency: payout.currency.toLowerCase(),
          destination: payout.stripeAccountId,
          metadata: {
            seller_id: payout.sellerId,
            payout_id: payoutRecord.id,
            transaction_count: payout.transactionCount.toString(),
            period_start: payout.periodStart.toISOString(),
            period_end: payout.periodEnd.toISOString(),
          },
        });

        // Update payout record with transfer ID
        await this.config.supabase
          .from('payouts')
          .update({
            stripe_transfer_id: transfer.id,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', payoutRecord.id);

        // Update earnings ledger entries
        await this.config.supabase
          .from('earnings_ledger')
          .update({
            payout_id: payoutRecord.id,
            payout_status: 'paid',
            payout_date: new Date().toISOString(),
          })
          .in('purchase_id', payout.purchaseIds)
          .eq('seller_id', payout.sellerId);

        results.push({
          payoutId: payoutRecord.id,
          sellerId: payout.sellerId,
          success: true,
          transferId: transfer.id,
        });

      } catch (error) {
        // Handle failed payout
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Update payout record as failed if it exists
        if (results.length > 0) {
          const payoutId = results[results.length - 1].payoutId;
          await this.config.supabase
            .from('payouts')
            .update({
              status: 'failed',
              failure_reason: errorMessage,
            })
            .eq('id', payoutId);
        }

        results.push({
          payoutId: '',
          sellerId: payout.sellerId,
          success: false,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Reconcile payouts with ledger entries
   */
  async reconcilePayouts(
    periodStart: Date,
    periodEnd: Date
  ): Promise<ReconciliationResult> {
    // Fetch all payouts for the period
    const { data: payouts, error: payoutError } = await this.config.supabase
      .from('payouts')
      .select('*')
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString())
      .eq('status', 'completed');

    if (payoutError || !payouts) {
      throw new Error(`Failed to fetch payouts: ${payoutError?.message}`);
    }

    const discrepancies: ReconciliationResult['discrepancies'] = [];
    let totalAmount = 0;
    let reconciledCount = 0;

    for (const payout of payouts) {
      // Fetch associated ledger entries
      const { data: ledgerEntries, error: ledgerError } = await this.config.supabase
        .from('earnings_ledger')
        .select('seller_earnings_cents')
        .eq('payout_id', payout.id);

      if (ledgerError || !ledgerEntries) {
        continue;
      }

      // Calculate total from ledger
      const ledgerTotal = ledgerEntries.reduce(
        (sum, entry) => sum + entry.seller_earnings_cents,
        0
      );

      totalAmount += payout.amount_cents;

      // Check for discrepancy
      if (ledgerTotal !== payout.amount_cents) {
        discrepancies.push({
          payoutId: payout.id,
          expectedAmount: payout.amount_cents,
          actualAmount: ledgerTotal,
          difference: payout.amount_cents - ledgerTotal,
        });
      } else {
        reconciledCount++;
      }
    }

    return {
      success: discrepancies.length === 0,
      discrepancies,
      summary: {
        totalPayouts: payouts.length,
        totalAmount,
        reconciledCount,
        discrepancyCount: discrepancies.length,
      },
    };
  }

  /**
   * Retry failed payouts
   */
  async retryFailedPayouts(periodStart: Date, periodEnd: Date): Promise<PayoutResult[]> {
    // Fetch failed payouts
    const { data: failedPayouts, error } = await this.config.supabase
      .from('payouts')
      .select('*')
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString())
      .eq('status', 'failed');

    if (error || !failedPayouts) {
      throw new Error(`Failed to fetch failed payouts: ${error?.message}`);
    }

    // Convert to PayoutCalculation format
    const payoutsToRetry: PayoutCalculation[] = [];

    for (const payout of failedPayouts) {
      // Fetch seller's Stripe account
      const { data: seller, error: sellerError } = await this.config.supabase
        .from('seller_agreements')
        .select('stripe_connect_account_id')
        .eq('user_id', payout.seller_id)
        .single();

      if (sellerError || !seller) {
        continue;
      }

      // Fetch purchase IDs
      const { data: ledgerEntries, error: ledgerError } = await this.config.supabase
        .from('earnings_ledger')
        .select('purchase_id')
        .eq('payout_id', payout.id);

      if (ledgerError || !ledgerEntries) {
        continue;
      }

      payoutsToRetry.push({
        sellerId: payout.seller_id,
        amountCents: payout.amount_cents,
        currency: payout.currency,
        stripeAccountId: seller.stripe_connect_account_id,
        transactionCount: payout.transaction_count,
        purchaseIds: ledgerEntries.map(e => e.purchase_id),
        periodStart: new Date(payout.period_start),
        periodEnd: new Date(payout.period_end),
      });
    }

    return this.processPayouts(payoutsToRetry);
  }

  /**
   * Generate payout report
   */
  async generatePayoutReport(
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    sellers: Array<{
      sellerId: string;
      totalPaid: number;
      transactionCount: number;
      currency: string;
    }>;
    summary: {
      totalPayouts: number;
      totalAmount: number;
      averagePayout: number;
      successRate: number;
    };
  }> {
    const { data: payouts, error } = await this.config.supabase
      .from('payouts')
      .select('*')
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString());

    if (error || !payouts) {
      throw new Error(`Failed to fetch payouts: ${error?.message}`);
    }

    // Group by seller
    const sellerSummary = new Map<string, any>();

    for (const payout of payouts) {
      const key = `${payout.seller_id}:${payout.currency}`;

      if (!sellerSummary.has(key)) {
        sellerSummary.set(key, {
          sellerId: payout.seller_id,
          totalPaid: 0,
          transactionCount: 0,
          currency: payout.currency,
        });
      }

      const summary = sellerSummary.get(key)!;

      if (payout.status === 'completed') {
        summary.totalPaid += payout.amount_cents;
        summary.transactionCount += payout.transaction_count;
      }
    }

    const completedPayouts = payouts.filter(p => p.status === 'completed');
    const totalAmount = completedPayouts.reduce((sum, p) => sum + p.amount_cents, 0);

    return {
      sellers: Array.from(sellerSummary.values()),
      summary: {
        totalPayouts: completedPayouts.length,
        totalAmount,
        averagePayout: completedPayouts.length > 0 ? totalAmount / completedPayouts.length : 0,
        successRate: payouts.length > 0 ? (completedPayouts.length / payouts.length) * 100 : 0,
      },
    };
  }
}
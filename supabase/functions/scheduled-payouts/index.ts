import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledPayoutRequest {
  action: 'check_schedules' | 'process_payout' | 'reconcile' | 'retry_failed';
  scheduleId?: string;
  periodStart?: string;
  periodEnd?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, scheduleId, periodStart, periodEnd } = await req.json() as ScheduledPayoutRequest;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    switch (action) {
      case 'check_schedules':
        return await checkAndProcessSchedules(supabase, stripe);

      case 'process_payout':
        if (!scheduleId) {
          throw new Error('scheduleId is required for process_payout action');
        }
        return await processSingleSchedule(supabase, stripe, scheduleId);

      case 'reconcile':
        if (!periodStart || !periodEnd) {
          throw new Error('periodStart and periodEnd are required for reconcile action');
        }
        return await reconcilePayouts(supabase, new Date(periodStart), new Date(periodEnd));

      case 'retry_failed':
        if (!periodStart || !periodEnd) {
          throw new Error('periodStart and periodEnd are required for retry_failed action');
        }
        return await retryFailedPayouts(supabase, stripe, new Date(periodStart), new Date(periodEnd));

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in scheduled-payouts function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Check all active schedules and process due payouts
 */
async function checkAndProcessSchedules(supabase: any, stripe: any) {
  const now = new Date();

  // Fetch active schedules that are due
  const { data: schedules, error } = await supabase
    .from('payout_schedule')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now.toISOString());

  if (error) {
    throw new Error(`Failed to fetch schedules: ${error.message}`);
  }

  const results = [];

  for (const schedule of schedules || []) {
    try {
      // Process this schedule
      const result = await processScheduledPayout(supabase, stripe, schedule);
      results.push(result);

      // Calculate and update next run time
      const { data: nextRun } = await supabase.rpc('calculate_next_payout_run', {
        p_schedule_type: schedule.schedule_type,
        p_day_of_week: schedule.day_of_week,
        p_day_of_month: schedule.day_of_month,
        p_hour_utc: schedule.hour_utc,
        p_last_run: now.toISOString(),
      });

      // Update schedule with results
      await supabase
        .from('payout_schedule')
        .update({
          last_run_at: now.toISOString(),
          last_run_status: result.success ? 'success' : 'failed',
          last_run_summary: result,
          next_run_at: nextRun,
        })
        .eq('id', schedule.id);

    } catch (error) {
      console.error(`Error processing schedule ${schedule.id}:`, error);
      results.push({
        scheduleId: schedule.id,
        success: false,
        error: error.message,
      });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Process a single scheduled payout
 */
async function processSingleSchedule(supabase: any, stripe: any, scheduleId: string) {
  // Fetch schedule
  const { data: schedule, error } = await supabase
    .from('payout_schedule')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (error || !schedule) {
    throw new Error(`Schedule not found: ${scheduleId}`);
  }

  const result = await processScheduledPayout(supabase, stripe, schedule);

  return new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Process payouts for a given schedule
 */
async function processScheduledPayout(supabase: any, stripe: any, schedule: any) {
  const now = new Date();
  const periodEnd = new Date(now);
  const periodStart = new Date(now);

  // Calculate period based on schedule type
  switch (schedule.schedule_type) {
    case 'weekly':
      periodStart.setDate(periodStart.getDate() - 7);
      break;
    case 'biweekly':
      periodStart.setDate(periodStart.getDate() - 14);
      break;
    case 'monthly':
      periodStart.setMonth(periodStart.getMonth() - 1);
      break;
    default:
      throw new Error(`Unsupported schedule type: ${schedule.schedule_type}`);
  }

  // Apply hold period
  const holdCutoff = new Date(now);
  holdCutoff.setDate(holdCutoff.getDate() - schedule.hold_period_days);

  // Fetch eligible earnings
  const { data: earnings, error: earningsError } = await supabase
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
    .lte('created_at', holdCutoff.toISOString())
    .is('payout_id', null);

  if (earningsError) {
    throw new Error(`Failed to fetch earnings: ${earningsError.message}`);
  }

  // Group earnings by seller and currency
  const sellerPayouts = new Map<string, any>();

  for (const earning of earnings || []) {
    const key = `${earning.seller_id}:${earning.currency}`;

    if (!sellerPayouts.has(key)) {
      sellerPayouts.set(key, {
        sellerId: earning.seller_id,
        amountCents: 0,
        currency: earning.currency,
        transactionCount: 0,
        purchaseIds: [],
      });
    }

    const payout = sellerPayouts.get(key);
    payout.amountCents += earning.seller_earnings_cents;
    payout.transactionCount += 1;
    payout.purchaseIds.push(earning.purchase_id);
  }

  // Filter by minimum payout threshold
  const eligiblePayouts = Array.from(sellerPayouts.values()).filter(
    payout => payout.amountCents >= schedule.minimum_payout_cents
  );

  // Fetch Stripe account IDs
  const sellerIds = [...new Set(eligiblePayouts.map(p => p.sellerId))];

  if (sellerIds.length === 0) {
    return {
      scheduleId: schedule.id,
      success: true,
      message: 'No eligible payouts',
      summary: {
        totalSellers: 0,
        totalAmount: 0,
        processed: 0,
        failed: 0,
      },
    };
  }

  const { data: sellers, error: sellersError } = await supabase
    .from('seller_agreements')
    .select('user_id, stripe_connect_account_id, charges_enabled, payouts_enabled')
    .in('user_id', sellerIds);

  if (sellersError) {
    throw new Error(`Failed to fetch sellers: ${sellersError.message}`);
  }

  // Process payouts
  const results = {
    processed: 0,
    failed: 0,
    totalAmount: 0,
    errors: [] as string[],
  };

  for (const payout of eligiblePayouts) {
    const seller = sellers?.find(s => s.user_id === payout.sellerId);

    if (!seller?.stripe_connect_account_id || !seller.payouts_enabled) {
      results.errors.push(`Seller ${payout.sellerId} not eligible for payouts`);
      results.failed++;
      continue;
    }

    try {
      // Create payout record
      const { data: payoutRecord, error: payoutError } = await supabase
        .from('payouts')
        .insert({
          seller_id: payout.sellerId,
          amount_cents: payout.amountCents,
          currency: payout.currency,
          status: 'processing',
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          transaction_count: payout.transactionCount,
          schedule_id: schedule.id,
          initiated_at: now.toISOString(),
        })
        .select()
        .single();

      if (payoutError) {
        throw new Error(`Failed to create payout record: ${payoutError.message}`);
      }

      // Record history
      await supabase
        .from('payout_history')
        .insert({
          payout_id: payoutRecord.id,
          schedule_id: schedule.id,
          action: 'created',
          actor_type: 'system',
          details: { schedule_name: schedule.schedule_name },
        });

      // Create Stripe transfer
      const transfer = await stripe.transfers.create({
        amount: payout.amountCents,
        currency: payout.currency.toLowerCase(),
        destination: seller.stripe_connect_account_id,
        metadata: {
          seller_id: payout.sellerId,
          payout_id: payoutRecord.id,
          schedule_id: schedule.id,
          transaction_count: payout.transactionCount.toString(),
        },
      });

      // Update payout record
      await supabase
        .from('payouts')
        .update({
          stripe_transfer_id: transfer.id,
          status: 'completed',
          completed_at: now.toISOString(),
        })
        .eq('id', payoutRecord.id);

      // Update earnings ledger
      await supabase
        .from('earnings_ledger')
        .update({
          payout_id: payoutRecord.id,
          payout_status: 'paid',
          payout_date: now.toISOString(),
        })
        .in('purchase_id', payout.purchaseIds);

      // Record success in history
      await supabase
        .from('payout_history')
        .insert({
          payout_id: payoutRecord.id,
          schedule_id: schedule.id,
          action: 'completed',
          actor_type: 'system',
          details: { transfer_id: transfer.id },
        });

      // Queue notification
      await supabase
        .from('payout_notifications')
        .insert({
          payout_id: payoutRecord.id,
          seller_id: payout.sellerId,
          notification_type: 'payout_completed',
          channel: 'email',
          recipient: seller.email || '', // Would need to fetch from users table
          status: 'pending',
        });

      results.processed++;
      results.totalAmount += payout.amountCents;

    } catch (error) {
      console.error(`Failed to process payout for seller ${payout.sellerId}:`, error);
      results.errors.push(error.message);
      results.failed++;

      // Record failure in history
      await supabase
        .from('payout_history')
        .insert({
          schedule_id: schedule.id,
          action: 'failed',
          actor_type: 'system',
          error_message: error.message,
          details: { seller_id: payout.sellerId, amount: payout.amountCents },
        });
    }
  }

  return {
    scheduleId: schedule.id,
    success: results.failed === 0,
    summary: {
      totalSellers: eligiblePayouts.length,
      totalAmount: results.totalAmount,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors,
    },
  };
}

/**
 * Reconcile payouts with ledger entries
 */
async function reconcilePayouts(supabase: any, periodStart: Date, periodEnd: Date) {
  // Fetch payouts for period
  const { data: payouts, error: payoutError } = await supabase
    .from('payouts')
    .select('*')
    .gte('period_start', periodStart.toISOString())
    .lte('period_end', periodEnd.toISOString())
    .eq('status', 'completed');

  if (payoutError) {
    throw new Error(`Failed to fetch payouts: ${payoutError.message}`);
  }

  const discrepancies = [];

  for (const payout of payouts || []) {
    // Fetch ledger entries
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('earnings_ledger')
      .select('seller_earnings_cents')
      .eq('payout_id', payout.id);

    if (ledgerError) {
      continue;
    }

    // Calculate total from ledger
    const ledgerTotal = ledgerEntries?.reduce(
      (sum, entry) => sum + entry.seller_earnings_cents,
      0
    ) || 0;

    // Check for discrepancy
    if (ledgerTotal !== payout.amount_cents) {
      const discrepancy = {
        payout_id: payout.id,
        expected_amount_cents: payout.amount_cents,
        actual_amount_cents: ledgerTotal,
        status: 'discrepancy',
      };

      // Record discrepancy
      await supabase
        .from('payout_reconciliation')
        .insert(discrepancy);

      discrepancies.push(discrepancy);
    } else {
      // Record successful reconciliation
      await supabase
        .from('payout_reconciliation')
        .insert({
          payout_id: payout.id,
          expected_amount_cents: payout.amount_cents,
          actual_amount_cents: ledgerTotal,
          status: 'matched',
        });
    }

    // Update payout reconciliation timestamp
    await supabase
      .from('payouts')
      .update({ reconciled_at: new Date().toISOString() })
      .eq('id', payout.id);
  }

  return new Response(
    JSON.stringify({
      success: discrepancies.length === 0,
      totalPayouts: payouts?.length || 0,
      discrepancies: discrepancies.length,
      details: discrepancies,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Retry failed payouts
 */
async function retryFailedPayouts(supabase: any, stripe: any, periodStart: Date, periodEnd: Date) {
  // Fetch failed payouts
  const { data: failedPayouts, error } = await supabase
    .from('payouts')
    .select('*')
    .gte('period_start', periodStart.toISOString())
    .lte('period_end', periodEnd.toISOString())
    .eq('status', 'failed');

  if (error) {
    throw new Error(`Failed to fetch failed payouts: ${error.message}`);
  }

  const results = {
    retried: 0,
    succeeded: 0,
    failed: 0,
  };

  for (const payout of failedPayouts || []) {
    try {
      // Fetch seller's Stripe account
      const { data: seller, error: sellerError } = await supabase
        .from('seller_agreements')
        .select('stripe_connect_account_id')
        .eq('user_id', payout.seller_id)
        .single();

      if (sellerError || !seller?.stripe_connect_account_id) {
        throw new Error('Seller not found or not onboarded');
      }

      // Retry Stripe transfer
      const transfer = await stripe.transfers.create({
        amount: payout.amount_cents,
        currency: payout.currency.toLowerCase(),
        destination: seller.stripe_connect_account_id,
        metadata: {
          seller_id: payout.seller_id,
          payout_id: payout.id,
          retry: 'true',
        },
      });

      // Update payout record
      await supabase
        .from('payouts')
        .update({
          stripe_transfer_id: transfer.id,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      // Record in history
      await supabase
        .from('payout_history')
        .insert({
          payout_id: payout.id,
          action: 'retried',
          actor_type: 'system',
          details: { transfer_id: transfer.id },
        });

      results.succeeded++;

    } catch (error) {
      console.error(`Failed to retry payout ${payout.id}:`, error);
      results.failed++;

      // Record failure
      await supabase
        .from('payout_history')
        .insert({
          payout_id: payout.id,
          action: 'failed',
          actor_type: 'system',
          error_message: error.message,
        });
    }

    results.retried++;
  }

  return new Response(
    JSON.stringify({
      success: results.failed === 0,
      summary: results,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
import { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export interface PayoutNotifierConfig {
  supabase: SupabaseClient;
  resend: Resend;
  fromEmail: string;
  baseUrl: string;
}

export interface NotificationData {
  payoutId: string;
  sellerId: string;
  amountCents: number;
  currency: string;
  transactionCount: number;
  periodStart: Date;
  periodEnd: Date;
  transferId?: string;
  failureReason?: string;
}

export class PayoutNotifier {
  constructor(private config: PayoutNotifierConfig) {}

  /**
   * Send payout initiated notification
   */
  async sendPayoutInitiated(data: NotificationData): Promise<void> {
    const seller = await this.getSellerInfo(data.sellerId);
    if (!seller?.email) return;

    const subject = 'Your payout is being processed';
    const html = this.generatePayoutInitiatedEmail(data, seller);

    await this.sendEmail(seller.email, subject, html, data.payoutId, 'payout_initiated');
  }

  /**
   * Send payout completed notification
   */
  async sendPayoutCompleted(data: NotificationData): Promise<void> {
    const seller = await this.getSellerInfo(data.sellerId);
    if (!seller?.email) return;

    const subject = `Payout of ${this.formatAmount(data.amountCents, data.currency)} completed`;
    const html = this.generatePayoutCompletedEmail(data, seller);

    await this.sendEmail(seller.email, subject, html, data.payoutId, 'payout_completed');
  }

  /**
   * Send payout failed notification
   */
  async sendPayoutFailed(data: NotificationData): Promise<void> {
    const seller = await this.getSellerInfo(data.sellerId);
    if (!seller?.email) return;

    const subject = 'Payout failed - Action required';
    const html = this.generatePayoutFailedEmail(data, seller);

    await this.sendEmail(seller.email, subject, html, data.payoutId, 'payout_failed');
  }

  /**
   * Send weekly payout summary
   */
  async sendWeeklyPayoutSummary(sellerId: string, weekStart: Date, weekEnd: Date): Promise<void> {
    const seller = await this.getSellerInfo(sellerId);
    if (!seller?.email) return;

    // Fetch week's earnings and payouts
    const summary = await this.getWeeklySummary(sellerId, weekStart, weekEnd);

    const subject = `Your weekly earnings summary (${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)})`;
    const html = this.generateWeeklySummaryEmail(summary, seller);

    await this.sendEmail(seller.email, subject, html, null, 'weekly_summary');
  }

  /**
   * Process pending notifications queue
   */
  async processPendingNotifications(): Promise<number> {
    // Fetch pending notifications
    const { data: notifications, error } = await this.config.supabase
      .from('payout_notifications')
      .select('*')
      .eq('status', 'pending')
      .limit(50);

    if (error || !notifications) {
      throw new Error(`Failed to fetch notifications: ${error?.message}`);
    }

    let processed = 0;

    for (const notification of notifications) {
      try {
        // Fetch payout details
        const { data: payout, error: payoutError } = await this.config.supabase
          .from('payouts')
          .select('*')
          .eq('id', notification.payout_id)
          .single();

        if (payoutError || !payout) continue;

        const data: NotificationData = {
          payoutId: payout.id,
          sellerId: payout.seller_id,
          amountCents: payout.amount_cents,
          currency: payout.currency,
          transactionCount: payout.transaction_count,
          periodStart: new Date(payout.period_start),
          periodEnd: new Date(payout.period_end),
          transferId: payout.stripe_transfer_id,
          failureReason: payout.failure_reason,
        };

        // Send appropriate notification
        switch (notification.notification_type) {
          case 'payout_initiated':
            await this.sendPayoutInitiated(data);
            break;
          case 'payout_completed':
            await this.sendPayoutCompleted(data);
            break;
          case 'payout_failed':
            await this.sendPayoutFailed(data);
            break;
        }

        // Mark as sent
        await this.config.supabase
          .from('payout_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        processed++;

      } catch (error) {
        console.error(`Failed to send notification ${notification.id}:`, error);

        // Mark as failed
        await this.config.supabase
          .from('payout_notifications')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', notification.id);
      }
    }

    return processed;
  }

  /**
   * Helper methods
   */

  private async getSellerInfo(sellerId: string): Promise<any> {
    const { data: user, error } = await this.config.supabase
      .from('users')
      .select('email, full_name, metadata')
      .eq('id', sellerId)
      .single();

    if (error || !user) {
      console.error(`Failed to fetch seller info: ${error?.message}`);
      return null;
    }

    return user;
  }

  private async getWeeklySummary(sellerId: string, weekStart: Date, weekEnd: Date): Promise<any> {
    // Fetch earnings for the week
    const { data: earnings, error: earningsError } = await this.config.supabase
      .from('earnings_ledger')
      .select('seller_earnings_cents, platform_fee_cents, created_at')
      .eq('seller_id', sellerId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    // Fetch payouts for the week
    const { data: payouts, error: payoutsError } = await this.config.supabase
      .from('payouts')
      .select('amount_cents, status, completed_at')
      .eq('seller_id', sellerId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    const totalEarnings = earnings?.reduce((sum, e) => sum + e.seller_earnings_cents, 0) || 0;
    const totalFees = earnings?.reduce((sum, e) => sum + e.platform_fee_cents, 0) || 0;
    const totalPayouts = payouts?.filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount_cents, 0) || 0;

    return {
      weekStart,
      weekEnd,
      totalEarnings,
      totalFees,
      totalPayouts,
      transactionCount: earnings?.length || 0,
      payoutCount: payouts?.filter(p => p.status === 'completed').length || 0,
    };
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    payoutId: string | null,
    notificationType: string
  ): Promise<void> {
    try {
      const { data, error } = await this.config.resend.emails.send({
        from: this.config.fromEmail,
        to,
        subject,
        html,
        tags: [
          { name: 'type', value: notificationType },
          ...(payoutId ? [{ name: 'payout_id', value: payoutId }] : []),
        ],
      });

      if (error) {
        throw error;
      }

      // Update notification record with email ID if payout-related
      if (payoutId && data?.id) {
        await this.config.supabase
          .from('payout_notifications')
          .update({ email_id: data.id })
          .eq('payout_id', payoutId)
          .eq('notification_type', notificationType);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  private formatAmount(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(cents / 100);
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Email templates
   */

  private generatePayoutInitiatedEmail(data: NotificationData, seller: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .amount { font-size: 32px; font-weight: bold; color: #10b981; margin: 20px 0; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Payout Processing</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your earnings are on the way!</p>
          </div>
          <div class="content">
            <p>Hi ${seller.full_name || 'there'},</p>

            <p>Great news! We're processing your payout for the period ${this.formatDate(data.periodStart)} to ${this.formatDate(data.periodEnd)}.</p>

            <div class="amount">${this.formatAmount(data.amountCents, data.currency)}</div>

            <div class="details">
              <div class="detail-row">
                <span>Period</span>
                <span>${this.formatDate(data.periodStart)} - ${this.formatDate(data.periodEnd)}</span>
              </div>
              <div class="detail-row">
                <span>Transactions</span>
                <span>${data.transactionCount}</span>
              </div>
              <div class="detail-row">
                <span>Status</span>
                <span style="color: #f59e0b;">Processing</span>
              </div>
            </div>

            <p>Your payout will be transferred to your connected bank account within 2-5 business days, depending on your bank's processing time.</p>

            <a href="${this.config.baseUrl}/dashboard/payouts/${data.payoutId}" class="button">View Payout Details</a>

            <div class="footer">
              <p>Questions? Reply to this email or visit our <a href="${this.config.baseUrl}/help/payouts">help center</a>.</p>
              <p>© ${new Date().getFullYear()} MindScript. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePayoutCompletedEmail(data: NotificationData, seller: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .amount { font-size: 32px; font-weight: bold; color: #10b981; margin: 20px 0; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .success-badge { display: inline-block; padding: 4px 12px; background: #d1fae5; color: #065f46; border-radius: 12px; font-size: 14px; font-weight: 600; }
          .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Payout Completed! 🎉</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your funds have been transferred</p>
          </div>
          <div class="content">
            <p>Hi ${seller.full_name || 'there'},</p>

            <p>Your payout has been successfully transferred to your bank account!</p>

            <div class="amount">${this.formatAmount(data.amountCents, data.currency)}</div>

            <div class="details">
              <div class="detail-row">
                <span>Transfer ID</span>
                <span style="font-family: monospace; font-size: 12px;">${data.transferId}</span>
              </div>
              <div class="detail-row">
                <span>Period</span>
                <span>${this.formatDate(data.periodStart)} - ${this.formatDate(data.periodEnd)}</span>
              </div>
              <div class="detail-row">
                <span>Transactions</span>
                <span>${data.transactionCount}</span>
              </div>
              <div class="detail-row">
                <span>Status</span>
                <span class="success-badge">Completed</span>
              </div>
            </div>

            <p>The funds should appear in your bank account within 1-2 business days, depending on your bank's processing time.</p>

            <a href="${this.config.baseUrl}/dashboard/payouts/${data.payoutId}" class="button">View Payout Details</a>

            <div class="footer">
              <p>Thank you for being part of the MindScript marketplace!</p>
              <p>© ${new Date().getFullYear()} MindScript. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePayoutFailedEmail(data: NotificationData, seller: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .amount { font-size: 32px; font-weight: bold; color: #6b7280; margin: 20px 0; }
          .alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .failed-badge { display: inline-block; padding: 4px 12px; background: #fee2e2; color: #991b1b; border-radius: 12px; font-size: 14px; font-weight: 600; }
          .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Payout Failed</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Action required to receive your funds</p>
          </div>
          <div class="content">
            <p>Hi ${seller.full_name || 'there'},</p>

            <div class="alert">
              <strong>⚠️ Important:</strong> We were unable to process your payout. Please review the details below and take action to resolve this issue.
            </div>

            <div class="amount">${this.formatAmount(data.amountCents, data.currency)}</div>

            <div class="details">
              <div class="detail-row">
                <span>Period</span>
                <span>${this.formatDate(data.periodStart)} - ${this.formatDate(data.periodEnd)}</span>
              </div>
              <div class="detail-row">
                <span>Transactions</span>
                <span>${data.transactionCount}</span>
              </div>
              <div class="detail-row">
                <span>Status</span>
                <span class="failed-badge">Failed</span>
              </div>
              ${data.failureReason ? `
              <div class="detail-row">
                <span>Reason</span>
                <span style="color: #ef4444;">${data.failureReason}</span>
              </div>
              ` : ''}
            </div>

            <p><strong>Common reasons for payout failures:</strong></p>
            <ul>
              <li>Incomplete bank account information</li>
              <li>Account verification pending</li>
              <li>Bank account restrictions</li>
            </ul>

            <p>Please update your payout settings to resolve this issue. Once updated, we'll automatically retry your payout.</p>

            <a href="${this.config.baseUrl}/dashboard/settings/payouts" class="button">Update Payout Settings</a>

            <div class="footer">
              <p>Need help? Contact our support team at <a href="mailto:support@mindscript.app">support@mindscript.app</a></p>
              <p>© ${new Date().getFullYear()} MindScript. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateWeeklySummaryEmail(summary: any, seller: any): string {
    const pendingBalance = summary.totalEarnings - summary.totalPayouts;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
          .stat-card { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0; }
          .stat-label { color: #6b7280; font-size: 14px; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Weekly Earnings Summary</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${this.formatDate(summary.weekStart)} - ${this.formatDate(summary.weekEnd)}</p>
          </div>
          <div class="content">
            <p>Hi ${seller.full_name || 'there'},</p>

            <p>Here's your earnings summary for the past week:</p>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Earned</div>
                <div class="stat-value" style="color: #10b981;">${this.formatAmount(summary.totalEarnings, 'USD')}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Transactions</div>
                <div class="stat-value">${summary.transactionCount}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Platform Fees</div>
                <div class="stat-value" style="color: #ef4444;">-${this.formatAmount(summary.totalFees, 'USD')}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Paid Out</div>
                <div class="stat-value" style="color: #6366f1;">${this.formatAmount(summary.totalPayouts, 'USD')}</div>
              </div>
            </div>

            <div class="details">
              <div class="detail-row">
                <span><strong>Pending Balance</strong></span>
                <span style="font-size: 18px; font-weight: bold; color: ${pendingBalance >= 1000 ? '#10b981' : '#6b7280'};">
                  ${this.formatAmount(pendingBalance, 'USD')}
                </span>
              </div>
              ${pendingBalance >= 1000 ? `
              <div class="detail-row">
                <span>Next Payout</span>
                <span style="color: #10b981;">Monday (meets $10 minimum)</span>
              </div>
              ` : `
              <div class="detail-row">
                <span>Next Payout</span>
                <span style="color: #6b7280;">When balance reaches $10</span>
              </div>
              `}
            </div>

            <p>Keep up the great work! Your tracks are making an impact in the MindScript community.</p>

            <a href="${this.config.baseUrl}/dashboard/earnings" class="button">View Full Earnings Report</a>

            <div class="footer">
              <p>This is an automated weekly summary. To unsubscribe, update your <a href="${this.config.baseUrl}/dashboard/settings/notifications">notification preferences</a>.</p>
              <p>© ${new Date().getFullYear()} MindScript. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
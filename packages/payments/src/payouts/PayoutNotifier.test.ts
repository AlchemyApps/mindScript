import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PayoutNotifier, PayoutNotifierConfig, NotificationData } from './PayoutNotifier';
import { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Mock Resend
vi.mock('resend');

describe('PayoutNotifier', () => {
  let notifier: PayoutNotifier;
  let mockSupabase: SupabaseClient;
  let mockResend: Resend;
  let config: PayoutNotifierConfig;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
    } as any;

    mockResend = {
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
      },
    } as any;

    config = {
      supabase: mockSupabase,
      resend: mockResend,
      fromEmail: 'noreply@mindscript.app',
      baseUrl: 'https://mindscript.app',
    };

    notifier = new PayoutNotifier(config);
  });

  describe('sendPayoutCompleted', () => {
    it('sends payout completed email with correct data', async () => {
      const notificationData: NotificationData = {
        payoutId: 'payout-123',
        sellerId: 'seller-456',
        amountCents: 5000,
        currency: 'USD',
        transactionCount: 10,
        periodStart: new Date('2025-01-06'),
        periodEnd: new Date('2025-01-13'),
        transferId: 'tr_123456',
      };

      // Mock seller info
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            email: 'seller@example.com',
            full_name: 'John Seller',
          },
          error: null,
        }),
      });

      await notifier.sendPayoutCompleted(notificationData);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@mindscript.app',
          to: 'seller@example.com',
          subject: 'Payout of $50.00 completed',
          html: expect.stringContaining('Payout Completed'),
          tags: [
            { name: 'type', value: 'payout_completed' },
            { name: 'payout_id', value: 'payout-123' },
          ],
        })
      );
    });

    it('skips email if seller has no email address', async () => {
      const notificationData: NotificationData = {
        payoutId: 'payout-123',
        sellerId: 'seller-456',
        amountCents: 5000,
        currency: 'USD',
        transactionCount: 10,
        periodStart: new Date('2025-01-06'),
        periodEnd: new Date('2025-01-13'),
      };

      // Mock seller info without email
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            full_name: 'John Seller',
            // No email field
          },
          error: null,
        }),
      });

      await notifier.sendPayoutCompleted(notificationData);

      expect(mockResend.emails.send).not.toHaveBeenCalled();
    });
  });

  describe('sendPayoutFailed', () => {
    it('sends payout failed email with failure reason', async () => {
      const notificationData: NotificationData = {
        payoutId: 'payout-123',
        sellerId: 'seller-456',
        amountCents: 5000,
        currency: 'USD',
        transactionCount: 10,
        periodStart: new Date('2025-01-06'),
        periodEnd: new Date('2025-01-13'),
        failureReason: 'Bank account not verified',
      };

      // Mock seller info
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            email: 'seller@example.com',
            full_name: 'John Seller',
          },
          error: null,
        }),
      });

      await notifier.sendPayoutFailed(notificationData);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@mindscript.app',
          to: 'seller@example.com',
          subject: 'Payout failed - Action required',
          html: expect.stringContaining('Bank account not verified'),
        })
      );
    });
  });

  describe('sendWeeklyPayoutSummary', () => {
    it('sends weekly summary with earnings and payout data', async () => {
      const sellerId = 'seller-456';
      const weekStart = new Date('2025-01-06');
      const weekEnd = new Date('2025-01-13');

      // Mock seller info
      let callCount = 0;
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                email: 'seller@example.com',
                full_name: 'John Seller',
              },
              error: null,
            }),
          };
        }
        if (table === 'earnings_ledger') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [
                { seller_earnings_cents: 3000, platform_fee_cents: 450 },
                { seller_earnings_cents: 2000, platform_fee_cents: 300 },
              ],
              error: null,
            }),
          };
        }
        if (table === 'payouts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [
                { amount_cents: 5000, status: 'completed' },
              ],
              error: null,
            }),
          };
        }
        return mockSupabase;
      }) as any;

      await notifier.sendWeeklyPayoutSummary(sellerId, weekStart, weekEnd);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@mindscript.app',
          to: 'seller@example.com',
          subject: 'Your weekly earnings summary (Jan 6, 2025 - Jan 13, 2025)',
          html: expect.stringContaining('Weekly Earnings Summary'),
        })
      );
    });
  });

  describe('processPendingNotifications', () => {
    it('processes pending notifications from queue', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          payout_id: 'payout-1',
          seller_id: 'seller-1',
          notification_type: 'payout_completed',
          status: 'pending',
        },
        {
          id: 'notif-2',
          payout_id: 'payout-2',
          seller_id: 'seller-2',
          notification_type: 'payout_failed',
          status: 'pending',
        },
      ];

      const mockPayouts = [
        {
          id: 'payout-1',
          seller_id: 'seller-1',
          amount_cents: 5000,
          currency: 'USD',
          transaction_count: 5,
          period_start: '2025-01-06T00:00:00Z',
          period_end: '2025-01-13T00:00:00Z',
          stripe_transfer_id: 'tr_123',
        },
        {
          id: 'payout-2',
          seller_id: 'seller-2',
          amount_cents: 3000,
          currency: 'USD',
          transaction_count: 3,
          period_start: '2025-01-06T00:00:00Z',
          period_end: '2025-01-13T00:00:00Z',
          failure_reason: 'Account suspended',
        },
      ];

      // Mock fetching notifications
      let fromCallCount = 0;
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'payout_notifications' && fromCallCount === 0) {
          fromCallCount++;
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: mockNotifications,
              error: null,
            }),
          };
        }
        if (table === 'payouts') {
          const payoutId = mockNotifications[fromCallCount - 1]?.payout_id;
          const payout = mockPayouts.find(p => p.id === payoutId);
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: payout,
              error: null,
            }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                email: `seller${fromCallCount}@example.com`,
                full_name: `Seller ${fromCallCount}`,
              },
              error: null,
            }),
          };
        }
        if (table === 'payout_notifications') {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabase;
      }) as any;

      const processed = await notifier.processPendingNotifications();

      expect(processed).toBe(2);
      expect(mockResend.emails.send).toHaveBeenCalledTimes(2);
    });

    it('marks notification as failed on error', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          payout_id: 'payout-1',
          seller_id: 'seller-1',
          notification_type: 'payout_completed',
          status: 'pending',
        },
      ];

      // Mock email send failure
      mockResend.emails.send = vi.fn().mockRejectedValue(new Error('Email service down'));

      const updateSpy = vi.fn().mockResolvedValue({ data: null, error: null });

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'payout_notifications') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: mockNotifications,
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: updateSpy,
          };
        }
        if (table === 'payouts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'payout-1',
                seller_id: 'seller-1',
                amount_cents: 5000,
                currency: 'USD',
                transaction_count: 5,
                period_start: '2025-01-06T00:00:00Z',
                period_end: '2025-01-13T00:00:00Z',
              },
              error: null,
            }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                email: 'seller@example.com',
                full_name: 'John Seller',
              },
              error: null,
            }),
          };
        }
        return mockSupabase;
      }) as any;

      const processed = await notifier.processPendingNotifications();

      expect(processed).toBe(0);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Email service down',
        })
      );
    });
  });
});
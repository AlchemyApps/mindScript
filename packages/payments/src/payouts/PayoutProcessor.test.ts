import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PayoutProcessor, PayoutCalculator, PayoutConfig } from './PayoutProcessor';
import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Mock dependencies
vi.mock('stripe');

describe('PayoutCalculator', () => {
  let calculator: PayoutCalculator;
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    // Create a chainable mock that returns itself for all methods
    const createChainableMock = () => {
      const mock: any = {};

      // Create chainable methods
      const chainMethods = ['select', 'eq', 'gte', 'lte', 'is', 'in', 'update', 'insert'];
      chainMethods.forEach(method => {
        mock[method] = vi.fn(() => mock);
      });

      // single doesn't return the mock
      mock.single = vi.fn();

      // from returns a new chain mock
      mock.from = vi.fn(() => {
        const tableMock: any = {};
        chainMethods.forEach(method => {
          tableMock[method] = vi.fn(() => tableMock);
        });
        tableMock.single = vi.fn();
        return tableMock;
      });

      return mock;
    };

    mockSupabase = createChainableMock();
    calculator = new PayoutCalculator(mockSupabase);
  });

  describe('calculatePayouts', () => {
    it('calculates payouts for sellers with balance above threshold', async () => {
      const periodStart = new Date('2025-01-06T00:00:00Z');
      const periodEnd = new Date('2025-01-13T00:00:00Z');

      // Mock earnings data
      const mockEarnings = [
        {
          seller_id: 'seller-1',
          seller_earnings_cents: 5000, // $50
          currency: 'USD',
          purchase_id: 'purchase-1',
        },
        {
          seller_id: 'seller-1',
          seller_earnings_cents: 3000, // $30
          currency: 'USD',
          purchase_id: 'purchase-2',
        },
        {
          seller_id: 'seller-2',
          seller_earnings_cents: 800, // $8 (below threshold)
          currency: 'USD',
          purchase_id: 'purchase-3',
        },
      ];

      // Mock seller agreements
      const mockSellers = [
        {
          user_id: 'seller-1',
          stripe_connect_account_id: 'acct_1234',
          charges_enabled: true,
          payouts_enabled: true,
        },
        {
          user_id: 'seller-2',
          stripe_connect_account_id: 'acct_5678',
          charges_enabled: true,
          payouts_enabled: true,
        },
      ];

      mockSupabase.from = vi.fn((table: string) => {
        const chainMock: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        };

        // Set up return values for each method
        Object.keys(chainMock).forEach(key => {
          chainMock[key].mockReturnValue(chainMock);
        });

        if (table === 'earnings_ledger') {
          chainMock.is.mockResolvedValue({ data: mockEarnings, error: null });
        }
        if (table === 'seller_agreements') {
          chainMock.in.mockResolvedValue({ data: mockSellers, error: null });
        }

        return chainMock;
      }) as any;

      const payouts = await calculator.calculatePayouts(periodStart, periodEnd);

      expect(payouts).toHaveLength(1); // Only seller-1 meets threshold
      expect(payouts[0]).toMatchObject({
        sellerId: 'seller-1',
        amountCents: 8000, // $80 total
        currency: 'USD',
        stripeAccountId: 'acct_1234',
        transactionCount: 2,
        purchaseIds: ['purchase-1', 'purchase-2'],
      });
    });

    it('respects the 7-day hold period for disputes', async () => {
      const periodStart = new Date('2025-01-06T00:00:00Z');
      const periodEnd = new Date('2025-01-13T00:00:00Z');

      const mockEarnings = [
        {
          seller_id: 'seller-1',
          seller_earnings_cents: 5000,
          currency: 'USD',
          purchase_id: 'purchase-1',
          created_at: '2025-01-12T00:00:00Z', // Within hold period
        },
        {
          seller_id: 'seller-1',
          seller_earnings_cents: 3000,
          currency: 'USD',
          purchase_id: 'purchase-2',
          created_at: '2025-01-05T00:00:00Z', // Outside hold period
        },
      ];

      const mockSellers = [
        {
          user_id: 'seller-1',
          stripe_connect_account_id: 'acct_1234',
          charges_enabled: true,
          payouts_enabled: true,
        },
      ];

      mockSupabase.from = vi.fn((table: string) => {
        const chainMock: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        };

        // Set up return values for each method
        Object.keys(chainMock).forEach(key => {
          chainMock[key].mockReturnValue(chainMock);
        });

        if (table === 'earnings_ledger') {
          chainMock.is.mockResolvedValue({ data: mockEarnings, error: null });
        }
        if (table === 'seller_agreements') {
          chainMock.in.mockResolvedValue({ data: mockSellers, error: null });
        }

        return chainMock;
      }) as any;

      const payouts = await calculator.calculatePayouts(periodStart, periodEnd, true);

      expect(payouts).toHaveLength(1);
      expect(payouts[0].amountCents).toBe(3000); // Only the older transaction
      expect(payouts[0].purchaseIds).toEqual(['purchase-2']);
    });

    it('handles multiple currencies correctly', async () => {
      const periodStart = new Date('2025-01-06T00:00:00Z');
      const periodEnd = new Date('2025-01-13T00:00:00Z');

      const mockEarnings = [
        {
          seller_id: 'seller-1',
          seller_earnings_cents: 5000,
          currency: 'USD',
          purchase_id: 'purchase-1',
        },
        {
          seller_id: 'seller-1',
          seller_earnings_cents: 4000,
          currency: 'EUR',
          purchase_id: 'purchase-2',
        },
      ];

      const mockSellers = [
        {
          user_id: 'seller-1',
          stripe_connect_account_id: 'acct_1234',
          charges_enabled: true,
          payouts_enabled: true,
        },
      ];

      mockSupabase.from = vi.fn((table: string) => {
        const chainMock: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        };

        // Set up return values for each method
        Object.keys(chainMock).forEach(key => {
          chainMock[key].mockReturnValue(chainMock);
        });

        if (table === 'earnings_ledger') {
          chainMock.is.mockResolvedValue({ data: mockEarnings, error: null });
        }
        if (table === 'seller_agreements') {
          chainMock.in.mockResolvedValue({ data: mockSellers, error: null });
        }

        return chainMock;
      }) as any;

      const payouts = await calculator.calculatePayouts(periodStart, periodEnd);

      expect(payouts).toHaveLength(2); // Separate payouts per currency
      const usdPayout = payouts.find(p => p.currency === 'USD');
      const eurPayout = payouts.find(p => p.currency === 'EUR');

      expect(usdPayout?.amountCents).toBe(5000);
      expect(eurPayout?.amountCents).toBe(4000);
    });
  });
});

describe('PayoutProcessor', () => {
  let processor: PayoutProcessor;
  let mockSupabase: SupabaseClient;
  let mockStripe: Stripe;
  let config: PayoutConfig;

  beforeEach(() => {
    // Create a chainable mock that returns itself for all methods
    const createChainableMock = () => {
      const mock: any = {};

      // Create chainable methods
      const chainMethods = ['select', 'eq', 'gte', 'lte', 'is', 'in', 'update', 'insert'];
      chainMethods.forEach(method => {
        mock[method] = vi.fn(() => mock);
      });

      // single doesn't return the mock
      mock.single = vi.fn();

      // from returns a new chain mock
      mock.from = vi.fn(() => {
        const tableMock: any = {};
        chainMethods.forEach(method => {
          tableMock[method] = vi.fn(() => tableMock);
        });
        tableMock.single = vi.fn();
        return tableMock;
      });

      return mock;
    };

    mockSupabase = createChainableMock();

    mockStripe = {
      transfers: {
        create: vi.fn(),
      },
    } as any;

    config = {
      supabase: mockSupabase,
      stripe: mockStripe,
      minimumPayoutCents: 1000, // $10
      platformFeePercent: 15,
      holdPeriodDays: 7,
    };

    processor = new PayoutProcessor(config);
  });

  describe('processPayouts', () => {
    it('creates Stripe transfers for eligible payouts', async () => {
      const payouts = [
        {
          sellerId: 'seller-1',
          amountCents: 8000,
          currency: 'USD',
          stripeAccountId: 'acct_1234',
          transactionCount: 2,
          purchaseIds: ['purchase-1', 'purchase-2'],
          periodStart: new Date('2025-01-06T00:00:00Z'),
          periodEnd: new Date('2025-01-13T00:00:00Z'),
        },
      ];

      const mockTransfer = {
        id: 'tr_1234',
        amount: 8000,
        currency: 'usd',
        destination: 'acct_1234',
      };

      mockStripe.transfers.create = vi.fn().mockResolvedValue(mockTransfer);

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'payout-1', stripe_transfer_id: 'tr_1234' },
          error: null,
        }),
      });

      const results = await processor.processPayouts(payouts);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].transferId).toBe('tr_1234');
      expect(mockStripe.transfers.create).toHaveBeenCalledWith({
        amount: 8000,
        currency: 'usd',
        destination: 'acct_1234',
        metadata: {
          seller_id: 'seller-1',
          payout_id: expect.any(String),
          transaction_count: '2',
          period_start: '2025-01-06T00:00:00.000Z',
          period_end: '2025-01-13T00:00:00.000Z',
        },
      });
    });

    it('handles transfer failures gracefully', async () => {
      const payouts = [
        {
          sellerId: 'seller-1',
          amountCents: 8000,
          currency: 'USD',
          stripeAccountId: 'acct_1234',
          transactionCount: 2,
          purchaseIds: ['purchase-1', 'purchase-2'],
          periodStart: new Date('2025-01-06T00:00:00Z'),
          periodEnd: new Date('2025-01-13T00:00:00Z'),
        },
      ];

      mockStripe.transfers.create = vi.fn().mockRejectedValue(
        new Error('Insufficient funds')
      );

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'payout-1' },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const results = await processor.processPayouts(payouts);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Insufficient funds');
    });

    it('updates earnings ledger after successful payout', async () => {
      const payouts = [
        {
          sellerId: 'seller-1',
          amountCents: 8000,
          currency: 'USD',
          stripeAccountId: 'acct_1234',
          transactionCount: 2,
          purchaseIds: ['purchase-1', 'purchase-2'],
          periodStart: new Date('2025-01-06T00:00:00Z'),
          periodEnd: new Date('2025-01-13T00:00:00Z'),
        },
      ];

      const mockTransfer = {
        id: 'tr_1234',
        amount: 8000,
        currency: 'usd',
        destination: 'acct_1234',
      };

      mockStripe.transfers.create = vi.fn().mockResolvedValue(mockTransfer);

      const updateSpy = vi.fn().mockResolvedValue({ data: null, error: null });

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'payouts') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'payout-1', stripe_transfer_id: 'tr_1234' },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'earnings_ledger') {
          return {
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({
              eq: updateSpy,
            }),
          };
        }
        return mockSupabase;
      }) as any;

      await processor.processPayouts(payouts);

      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('reconcilePayouts', () => {
    it('verifies payout amounts match ledger entries', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          seller_id: 'seller-1',
          amount_cents: 8000,
          currency: 'USD',
          status: 'completed',
        },
      ];

      const mockLedgerEntries = [
        {
          payout_id: 'payout-1',
          seller_earnings_cents: 5000,
        },
        {
          payout_id: 'payout-1',
          seller_earnings_cents: 3000,
        },
      ];

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'payouts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockPayouts, error: null }),
          };
        }
        if (table === 'earnings_ledger') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockLedgerEntries, error: null }),
          };
        }
        return mockSupabase;
      }) as any;

      const result = await processor.reconcilePayouts(new Date('2025-01-06'), new Date('2025-01-13'));

      expect(result.success).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('detects discrepancies in payout amounts', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          seller_id: 'seller-1',
          amount_cents: 8000,
          currency: 'USD',
          status: 'completed',
        },
      ];

      const mockLedgerEntries = [
        {
          payout_id: 'payout-1',
          seller_earnings_cents: 5000,
        },
        {
          payout_id: 'payout-1',
          seller_earnings_cents: 2000, // Should be 3000
        },
      ];

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'payouts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockPayouts, error: null }),
          };
        }
        if (table === 'earnings_ledger') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockLedgerEntries, error: null }),
          };
        }
        return mockSupabase;
      }) as any;

      const result = await processor.reconcilePayouts(new Date('2025-01-06'), new Date('2025-01-13'));

      expect(result.success).toBe(false);
      expect(result.discrepancies).toHaveLength(1);
      expect(result.discrepancies[0]).toMatchObject({
        payoutId: 'payout-1',
        expectedAmount: 8000,
        actualAmount: 7000,
        difference: 1000,
      });
    });
  });
});
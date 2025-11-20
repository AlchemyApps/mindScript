import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import Stripe from 'stripe';
import { startTrackBuild } from '../../../../lib/track-builder';

const mockStripeInstance = vi.hoisted(() => ({
  webhooks: {
    constructEvent: vi.fn(),
  },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => mockStripeInstance),
}));

const mockSupabaseFrom = vi.hoisted(() => vi.fn());
const mockListUsers = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { users: [] }, error: null })
);

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
    auth: {
      admin: {
        listUsers: mockListUsers,
      },
    },
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

vi.mock('../../../../lib/track-builder', () => ({
  startTrackBuild: vi.fn(async () => 'track-123'),
}));

const buildRequest = (event: any) =>
  new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': 'sig_test',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

const okResponse = { data: null, error: null };

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeInstance.webhooks.constructEvent.mockReset();
    mockSupabaseFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'webhook_events':
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'evt-db' },
                  error: null,
                }),
              }),
            }),
          };
        case 'purchases':
          return {
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'purchase-123' },
                  error: null,
                }),
              }),
            }),
          };
        case 'notifications_queue':
          return {
            insert: vi.fn().mockResolvedValue(okResponse),
          };
        case 'pending_tracks':
          return {
            delete: () => ({
              eq: vi.fn().mockResolvedValue(okResponse),
            }),
          };
        case 'profiles':
          return {
            update: () => ({
              eq: vi.fn().mockResolvedValue(okResponse),
            }),
            select: () => ({
              eq: () => ({
                single: vi.fn().mockRejectedValue({}),
              }),
            }),
          };
        default:
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue(okResponse),
              }),
            }),
          };
      }
    });
  });

  it('processes checkout session completions and starts track build', async () => {
    const metadata = {
      user_id: 'user-123',
      track_config: JSON.stringify({
        title: 'Morning Loop',
        script: 'Hello world',
        voice: { provider: 'openai', voice_id: 'alloy' },
      }),
      is_first_purchase: 'false',
    };

    const mockEvent = {
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_status: 'paid',
          payment_intent: 'pi_123',
          amount_total: 1500,
          currency: 'usd',
          metadata,
        },
      },
    };

    mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const response = await POST(buildRequest(mockEvent));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(startTrackBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        purchaseId: 'purchase-123',
      })
    );
  });

  it('resolves email-based user ids via admin lookup', async () => {
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ id: 'resolved-user-id' }] },
      error: null,
    });

    const metadata = {
      user_id: 'user@example.com',
      track_config: JSON.stringify({
        title: 'Email Track',
        script: 'Example script',
        voice: { provider: 'openai', voice_id: 'alloy' },
      }),
      is_first_purchase: 'false',
    };

    const mockEvent = {
      id: 'evt_456',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_email',
          payment_status: 'paid',
          payment_intent: 'pi_email',
          amount_total: 1000,
          currency: 'usd',
          metadata,
        },
      },
    };

    mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const response = await POST(buildRequest(mockEvent));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockListUsers).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(startTrackBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'resolved-user-id',
      })
    );
  });

  it('processes invoice payments using line metadata', async () => {
    const metadata = {
      user_id: 'user-456',
      track_config: JSON.stringify({
        title: 'Invoice Track',
        script: 'Invoice script',
        voice: { provider: 'openai', voice_id: 'alloy' },
      }),
    };

    const mockEvent = {
      id: 'evt_invoice',
      type: 'invoice.payment.paid',
      data: {
        object: {
          id: 'in_123',
          amount_paid: 2500,
          currency: 'usd',
          lines: {
            data: [{ metadata }],
          },
        },
      },
    };

    mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const response = await POST(buildRequest(mockEvent));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(startTrackBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-456',
      })
    );
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        in: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
      in: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  })),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

describe('/api/pricing/check-eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET - Check eligibility', () => {
    it('should return discounted pricing for anonymous users', async () => {
      // Mock anonymous user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      // Mock pricing configs
      mockSupabaseClient.from.mockReturnValue({
        select: () => ({
          in: () => ({
            eq: () => Promise.resolve({
              data: [
                { key: 'base_intro_web_cents', value: '99' },
                { key: 'base_standard_web_cents', value: '299' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/pricing/check-eligibility');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isEligibleForDiscount).toBe(true);
      expect(data.userStatus).toBe('anonymous');
      expect(data.pricing.discountedPrice).toBe(99);
      expect(data.pricing.basePrice).toBe(299);
      expect(data.pricing.savings).toBe(200);
    });

    it('should return discounted pricing for new authenticated users', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
      });

      // Mock user profile not found (new user)
      mockSupabaseClient.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { code: 'PGRST116' }, // Not found error
            }),
          }),
          in: () => ({
            eq: () => Promise.resolve({
              data: [
                { key: 'base_intro_web_cents', value: '99' },
                { key: 'base_standard_web_cents', value: '299' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/pricing/check-eligibility');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isEligibleForDiscount).toBe(true);
      expect(data.userStatus).toBe('new_user');
    });

    it('should return discounted pricing for existing eligible users', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
      });

      // Mock user profile with unused discount
      mockSupabaseClient.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                first_track_discount_used: false,
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
          in: () => ({
            eq: () => Promise.resolve({
              data: [
                { key: 'base_intro_web_cents', value: '99' },
                { key: 'base_standard_web_cents', value: '299' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/pricing/check-eligibility');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isEligibleForDiscount).toBe(true);
      expect(data.userStatus).toBe('existing_eligible');
    });

    it('should return regular pricing for existing ineligible users', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
      });

      // Mock user profile with used discount
      mockSupabaseClient.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                first_track_discount_used: true,
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
          in: () => ({
            eq: () => Promise.resolve({
              data: [
                { key: 'base_intro_web_cents', value: '99' },
                { key: 'base_standard_web_cents', value: '299' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/pricing/check-eligibility');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isEligibleForDiscount).toBe(false);
      expect(data.userStatus).toBe('existing_ineligible');
      expect(data.pricing.discountedPrice).toBe(299);
      expect(data.pricing.basePrice).toBe(299);
      expect(data.pricing.savings).toBe(0);
    });
  });

  describe('POST - Re-check pricing after signin', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = new NextRequest('http://localhost:3000/api/pricing/check-eligibility', {
        method: 'POST',
        body: JSON.stringify({ currentPrice: 99 }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should detect price increase when user already used discount', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
      });

      // Mock RPC call returning false (not eligible)
      mockSupabaseClient.rpc.mockResolvedValue({
        data: false,
        error: null,
      });

      // Mock pricing configs
      mockSupabaseClient.from.mockReturnValue({
        select: () => ({
          in: () => ({
            eq: () => Promise.resolve({
              data: [
                { key: 'base_intro_web_cents', value: '99' },
                { key: 'base_standard_web_cents', value: '299' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/pricing/check-eligibility', {
        method: 'POST',
        body: JSON.stringify({ currentPrice: 99 }), // User expects discount price
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priceChanged).toBe(true);
      expect(data.currentPrice).toBe(99);
      expect(data.correctPrice).toBe(299);
      expect(data.isEligible).toBe(false);
      expect(data.message).toContain('already used');
    });

    it('should confirm pricing when user is eligible for discount', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
      });

      // Mock RPC call returning true (eligible)
      mockSupabaseClient.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      // Mock pricing configs
      mockSupabaseClient.from.mockReturnValue({
        select: () => ({
          in: () => ({
            eq: () => Promise.resolve({
              data: [
                { key: 'base_intro_web_cents', value: '99' },
                { key: 'base_standard_web_cents', value: '299' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/pricing/check-eligibility', {
        method: 'POST',
        body: JSON.stringify({ currentPrice: 99 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priceChanged).toBe(false);
      expect(data.currentPrice).toBe(99);
      expect(data.correctPrice).toBe(99);
      expect(data.isEligible).toBe(true);
      expect(data.message).toBe('Pricing confirmed.');
    });
  });
});
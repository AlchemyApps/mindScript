import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit, createUserRateLimit, RATE_LIMITS } from './rate-limit';

// Mock timers
vi.useFakeTimers();

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    // Clear the in-memory store
    const rateLimit = await import('./rate-limit');
    // Access the store via module internals (we'd need to export it for proper testing)
  });

  describe('rateLimit', () => {
    it('should allow requests within limit', () => {
      const limiter = rateLimit({
        windowMs: 60000, // 1 minute
        max: 5,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result1 = limiter(request);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
      expect(result1.totalHits).toBe(1);

      const result2 = limiter(request);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
      expect(result2.totalHits).toBe(2);
    });

    it('should block requests exceeding limit', () => {
      const limiter = rateLimit({
        windowMs: 60000, // 1 minute
        max: 2,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // First two requests should be allowed
      const result1 = limiter(request);
      expect(result1.allowed).toBe(true);

      const result2 = limiter(request);
      expect(result2.allowed).toBe(true);

      // Third request should be blocked
      const result3 = limiter(request);
      expect(result3.allowed).toBe(false);
      expect(result3.remaining).toBe(0);
      expect(result3.totalHits).toBe(3);
    });

    it('should reset after window expires', () => {
      const windowMs = 60000;
      const limiter = rateLimit({
        windowMs,
        max: 2,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Exhaust the limit
      limiter(request);
      limiter(request);
      const blockedResult = limiter(request);
      expect(blockedResult.allowed).toBe(false);

      // Fast forward past the window
      vi.advanceTimersByTime(windowMs + 1000);

      // Should be allowed again
      const result = limiter(request);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
      expect(result.totalHits).toBe(1);
    });

    it('should use custom key generator', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: () => 'custom-key',
      });

      const request1 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });

      // Both requests should share the same limit due to custom key
      limiter(request1);
      limiter(request1);
      const result = limiter(request2); // Different IP but same key
      expect(result.allowed).toBe(false);
    });

    it('should handle different client IPs separately', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 1,
      });

      const request1 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });

      const result1 = limiter(request1);
      expect(result1.allowed).toBe(true);

      const result2 = limiter(request2);
      expect(result2.allowed).toBe(true); // Different IP, separate limit
    });

    it('should extract IP from x-real-ip header', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-real-ip': '192.168.1.100' },
      });

      const result = limiter(request);
      expect(result.allowed).toBe(true);
    });

    it('should prioritize x-forwarded-for over x-real-ip', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 192.168.1.2',
          'x-real-ip': '192.168.1.100',
        },
      });

      // Should use first IP from x-forwarded-for
      limiter(request);

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-real-ip': '192.168.1.100' },
      });

      // Should be allowed since it's different from the first IP
      const result = limiter(request2);
      expect(result.allowed).toBe(true);
    });

    it('should handle missing IP headers gracefully', () => {
      const limiter = rateLimit({
        windowMs: 60000,
        max: 2,
      });

      const request1 = new NextRequest('http://localhost:3000/api/test');
      const request2 = new NextRequest('http://localhost:3000/api/test');

      const result1 = limiter(request1);
      expect(result1.allowed).toBe(true);

      const result2 = limiter(request2);
      expect(result2.allowed).toBe(true);

      // Third request should be blocked (same 'unknown' key)
      const result3 = limiter(request2);
      expect(result3.allowed).toBe(false);
    });
  });

  describe('createUserRateLimit', () => {
    it('should create user-specific rate limiter', () => {
      const userId = 'user-123';
      const limiter = createUserRateLimit(userId, {
        windowMs: 60000,
        max: 3,
      });

      const request = new NextRequest('http://localhost:3000/api/test');

      const result = limiter(request);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should use user ID as key regardless of IP', () => {
      const userId = 'user-123';
      const limiter = createUserRateLimit(userId, {
        windowMs: 60000,
        max: 2,
      });

      const request1 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });

      // Both requests should share the limit since they have the same user ID
      limiter(request1);
      limiter(request1);
      const result = limiter(request2);
      expect(result.allowed).toBe(false);
    });
  });

  describe('RATE_LIMITS configuration', () => {
    it('should have proper render rate limits', () => {
      expect(RATE_LIMITS.render.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(RATE_LIMITS.render.max).toBe(5); // 5 renders per hour
    });

    it('should have proper status check rate limits', () => {
      expect(RATE_LIMITS.status.windowMs).toBe(60 * 1000); // 1 minute
      expect(RATE_LIMITS.status.max).toBe(60); // 60 checks per minute
    });

    it('should have proper download rate limits', () => {
      expect(RATE_LIMITS.download.windowMs).toBe(5 * 60 * 1000); // 5 minutes
      expect(RATE_LIMITS.download.max).toBe(50); // 50 downloads per 5 minutes
    });

    it('should have proper cancel rate limits', () => {
      expect(RATE_LIMITS.cancel.windowMs).toBe(60 * 1000); // 1 minute
      expect(RATE_LIMITS.cancel.max).toBe(10); // 10 cancellations per minute
    });
  });

  describe('cleanup mechanism', () => {
    it('should clean up expired entries', () => {
      const limiter = rateLimit({
        windowMs: 1000, // 1 second
        max: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Use the limit
      limiter(request);

      // Fast forward past expiry
      vi.advanceTimersByTime(2000);

      // Trigger cleanup interval (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Entry should be cleaned up and limit reset
      const result = limiter(request);
      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(1); // Fresh start
    });
  });
});
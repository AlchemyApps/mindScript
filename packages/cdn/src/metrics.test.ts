import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CDNMetrics, MetricsDataSchema } from './metrics';

describe('CDNMetrics', () => {
  let metrics: CDNMetrics;
  const distributionId = 'distribution-123';

  beforeEach(() => {
    metrics = new CDNMetrics(distributionId);
    vi.clearAllMocks();
  });

  describe('fetchMetrics', () => {
    it('should fetch and return metrics data', async () => {
      const data = await metrics.fetchMetrics();

      expect(data).toBeDefined();
      expect(data.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(data.cacheHitRate).toBeLessThanOrEqual(100);
      expect(data.originLatency).toBeGreaterThan(0);
      expect(data.errorRate).toBeGreaterThanOrEqual(0);
      expect(data.bytesDownloaded).toBeGreaterThanOrEqual(0);
      expect(data.bytesUploaded).toBeGreaterThanOrEqual(0);
      expect(data.requests).toBeGreaterThanOrEqual(0);
      expect(data.timestamp).toBeInstanceOf(Date);
    });

    it('should cache metrics for subsequent calls', async () => {
      const firstCall = await metrics.fetchMetrics();
      const secondCall = await metrics.fetchMetrics();

      expect(firstCall).toEqual(secondCall);
    });

    it('should validate metrics data schema', async () => {
      const data = await metrics.fetchMetrics();
      const validated = MetricsDataSchema.parse(data);

      expect(validated).toEqual(data);
    });
  });

  describe('calculateEfficiencyScore', () => {
    it('should calculate efficiency score for perfect metrics', () => {
      const perfectMetrics = {
        cacheHitRate: 100,
        originLatency: 0,
        errorRate: 0,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      };

      const score = metrics.calculateEfficiencyScore(perfectMetrics);
      expect(score).toBe(100);
    });

    it('should calculate efficiency score for poor metrics', () => {
      const poorMetrics = {
        cacheHitRate: 0,
        originLatency: 2000,
        errorRate: 100,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      };

      const score = metrics.calculateEfficiencyScore(poorMetrics);
      expect(score).toBe(0);
    });

    it('should calculate efficiency score for average metrics', () => {
      const averageMetrics = {
        cacheHitRate: 80,
        originLatency: 300,
        errorRate: 1,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      };

      const score = metrics.calculateEfficiencyScore(averageMetrics);
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThan(100);
    });

    it('should weight cache hit rate most heavily', () => {
      const highCacheMetrics = {
        cacheHitRate: 100,
        originLatency: 1000,
        errorRate: 10,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      };

      const score = metrics.calculateEfficiencyScore(highCacheMetrics);
      expect(score).toBeGreaterThan(40); // 50% weight on perfect cache hit rate
    });
  });

  describe('getMetricsSummary', () => {
    it('should return comprehensive metrics summary', async () => {
      const summary = await metrics.getMetricsSummary();

      expect(summary).toHaveProperty('current');
      expect(summary).toHaveProperty('efficiencyScore');
      expect(summary).toHaveProperty('recommendations');
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    it('should provide recommendations for low cache hit rate', async () => {
      // Mock fetchMetrics to return low cache hit rate
      vi.spyOn(metrics, 'fetchMetrics').mockResolvedValueOnce({
        cacheHitRate: 70,
        originLatency: 200,
        errorRate: 0.5,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      });

      const summary = await metrics.getMetricsSummary();

      expect(summary.recommendations).toContain(
        'Consider increasing cache TTL for frequently accessed content'
      );
    });

    it('should provide recommendations for high origin latency', async () => {
      vi.spyOn(metrics, 'fetchMetrics').mockResolvedValueOnce({
        cacheHitRate: 85,
        originLatency: 600,
        errorRate: 0.5,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      });

      const summary = await metrics.getMetricsSummary();

      expect(summary.recommendations).toContain(
        'Origin latency is high - consider optimizing origin server performance'
      );
    });

    it('should provide recommendations for high error rate', async () => {
      vi.spyOn(metrics, 'fetchMetrics').mockResolvedValueOnce({
        cacheHitRate: 85,
        originLatency: 200,
        errorRate: 2,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      });

      const summary = await metrics.getMetricsSummary();

      expect(summary.recommendations).toContain(
        'Error rate is elevated - review origin server logs and CloudFront error logs'
      );
    });

    it('should return empty recommendations for good metrics', async () => {
      vi.spyOn(metrics, 'fetchMetrics').mockResolvedValueOnce({
        cacheHitRate: 90,
        originLatency: 200,
        errorRate: 0.5,
        bytesDownloaded: 1000000,
        bytesUploaded: 100000,
        requests: 1000,
        timestamp: new Date(),
      });

      const summary = await metrics.getMetricsSummary();

      expect(summary.recommendations).toHaveLength(0);
    });
  });

  describe('trackEvent', () => {
    it('should log event with metadata', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      metrics.trackEvent('cache_miss', {
        path: '/track-123.mp3',
        size: 5242880,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'CDN Event: cache_miss',
        expect.objectContaining({
          distributionId,
          timestamp: expect.any(String),
          path: '/track-123.mp3',
          size: 5242880,
        })
      );
    });

    it('should log event without metadata', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      metrics.trackEvent('invalidation_started');

      expect(consoleSpy).toHaveBeenCalledWith(
        'CDN Event: invalidation_started',
        expect.objectContaining({
          distributionId,
          timestamp: expect.any(String),
        })
      );
    });
  });
});
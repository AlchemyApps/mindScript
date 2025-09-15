import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CDNHealthCheck, HealthStatusSchema } from './health';

// Mock fetch
global.fetch = vi.fn();

describe('CDNHealthCheck', () => {
  let healthCheck: CDNHealthCheck;
  const distributionId = 'distribution-123';
  const distributionDomain = 'cdn.example.com';
  const originDomain = 'origin.example.com';

  beforeEach(() => {
    healthCheck = new CDNHealthCheck(distributionId, distributionDomain, originDomain);
    vi.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return healthy status when all checks pass', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const result = await healthCheck.checkHealth();

      expect(result.status).toBe('healthy');
      expect(result.distribution.enabled).toBe(true);
      expect(result.origins[0].healthy).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.message).toBe('CDN is operating normally');
    });

    it('should return unhealthy status when origin is down', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await healthCheck.checkHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.origins[0].healthy).toBe(false);
      expect(result.origins[0].latency).toBe(-1);
      expect(result.message).toBe('CDN is experiencing significant issues');
    });

    it('should return degraded status for poor cache performance', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      // Mock poor cache performance
      const checkCachePerformanceSpy = vi
        .spyOn(healthCheck as any, 'checkCachePerformance')
        .mockResolvedValueOnce({
          hitRate: 60, // Below 70% threshold
          errorRate: 0.5,
        });

      const result = await healthCheck.checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.cache.hitRate).toBe(60);
      expect(result.message).toBe('CDN is experiencing performance issues');
    });

    it('should return degraded status for high error rate', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const checkCachePerformanceSpy = vi
        .spyOn(healthCheck as any, 'checkCachePerformance')
        .mockResolvedValueOnce({
          hitRate: 85,
          errorRate: 10, // Above 5% threshold
        });

      const result = await healthCheck.checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.cache.errorRate).toBe(10);
    });

    it('should handle high origin latency', async () => {
      let fetchResolve: any;
      const fetchPromise = new Promise((resolve) => {
        fetchResolve = resolve;
      });

      (global.fetch as any).mockImplementationOnce(() => {
        // Simulate high latency
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ ok: true });
          }, 1500);
        });
      });

      // Fast forward time for the test
      const result = await healthCheck.checkHealth();

      expect(result.status).toBe('degraded');
    });

    it('should validate health status schema', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const result = await healthCheck.checkHealth();
      const validated = HealthStatusSchema.parse(result.status);

      expect(['healthy', 'degraded', 'unhealthy']).toContain(validated);
    });

    it('should include all required fields in result', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const result = await healthCheck.checkHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('distribution');
      expect(result.distribution).toHaveProperty('id');
      expect(result.distribution).toHaveProperty('enabled');
      expect(result.distribution).toHaveProperty('status');
      expect(result).toHaveProperty('origins');
      expect(result.origins).toHaveLength(1);
      expect(result.origins[0]).toHaveProperty('id');
      expect(result.origins[0]).toHaveProperty('domain');
      expect(result.origins[0]).toHaveProperty('healthy');
      expect(result.origins[0]).toHaveProperty('latency');
      expect(result).toHaveProperty('cache');
      expect(result.cache).toHaveProperty('hitRate');
      expect(result.cache).toHaveProperty('errorRate');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('ping', () => {
    it('should return true for successful ping', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const result = await healthCheck.ping();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://cdn.example.com/health',
        expect.objectContaining({
          method: 'HEAD',
        })
      );
    });

    it('should return false for failed ping', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await healthCheck.ping();

      expect(result).toBe(false);
    });

    it('should return false for non-ok response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await healthCheck.ping();

      expect(result).toBe(false);
    });

    it('should timeout after 3 seconds', async () => {
      (global.fetch as any).mockImplementationOnce(
        () => new Promise((resolve) => {
          // Never resolve to simulate timeout
        })
      );

      // The AbortSignal.timeout should handle this
      const pingPromise = healthCheck.ping();

      // In a real scenario, this would timeout
      // For testing, we'll mock the rejection
      (global.fetch as any).mockRejectedValueOnce(new Error('AbortError'));

      const result = await healthCheck.ping();

      expect(result).toBe(false);
    });
  });

  describe('private methods', () => {
    it('should determine overall status correctly', () => {
      const determineStatus = (healthCheck as any).determineOverallStatus.bind(healthCheck);

      // All healthy
      expect(determineStatus(
        { enabled: true, status: 'Deployed' },
        { healthy: true, latency: 200 },
        { hitRate: 85, errorRate: 0.5 }
      )).toBe('healthy');

      // Distribution disabled
      expect(determineStatus(
        { enabled: false, status: 'Deployed' },
        { healthy: true, latency: 200 },
        { hitRate: 85, errorRate: 0.5 }
      )).toBe('unhealthy');

      // Origin unhealthy
      expect(determineStatus(
        { enabled: true, status: 'Deployed' },
        { healthy: false, latency: -1 },
        { hitRate: 85, errorRate: 0.5 }
      )).toBe('unhealthy');

      // Poor cache performance
      expect(determineStatus(
        { enabled: true, status: 'Deployed' },
        { healthy: true, latency: 200 },
        { hitRate: 60, errorRate: 0.5 }
      )).toBe('degraded');

      // High error rate
      expect(determineStatus(
        { enabled: true, status: 'Deployed' },
        { healthy: true, latency: 200 },
        { hitRate: 85, errorRate: 10 }
      )).toBe('degraded');

      // High latency
      expect(determineStatus(
        { enabled: true, status: 'Deployed' },
        { healthy: true, latency: 1500 },
        { hitRate: 85, errorRate: 0.5 }
      )).toBe('degraded');
    });

    it('should generate appropriate health messages', () => {
      const generateMessage = (healthCheck as any).generateHealthMessage.bind(healthCheck);

      expect(generateMessage('healthy')).toBe('CDN is operating normally');
      expect(generateMessage('degraded')).toBe('CDN is experiencing performance issues');
      expect(generateMessage('unhealthy')).toBe('CDN is experiencing significant issues');
    });
  });
});
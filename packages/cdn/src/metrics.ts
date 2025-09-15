import { z } from 'zod';

export const MetricsDataSchema = z.object({
  cacheHitRate: z.number().min(0).max(100),
  originLatency: z.number().positive(),
  errorRate: z.number().min(0).max(100),
  bytesDownloaded: z.number().int().nonnegative(),
  bytesUploaded: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
  timestamp: z.date(),
});

export type MetricsData = z.infer<typeof MetricsDataSchema>;

export class CDNMetrics {
  private distributionId: string;
  private metricsCache: Map<string, MetricsData> = new Map();
  private cacheTTL = 60000; // 1 minute cache

  constructor(distributionId: string) {
    this.distributionId = distributionId;
  }

  /**
   * Fetch current metrics from CloudWatch
   * Note: This is a placeholder - actual implementation would use CloudWatch client
   */
  async fetchMetrics(): Promise<MetricsData> {
    const cacheKey = 'current';
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTTL) {
      return cached;
    }

    // In real implementation, fetch from CloudWatch:
    // const client = new CloudWatchClient({ region: 'us-east-1' });
    // const metrics = await client.send(new GetMetricStatisticsCommand({...}));

    const mockMetrics: MetricsData = {
      cacheHitRate: 85.5,
      originLatency: 250,
      errorRate: 0.5,
      bytesDownloaded: 1024 * 1024 * 100, // 100MB
      bytesUploaded: 1024 * 1024 * 10, // 10MB
      requests: 10000,
      timestamp: new Date(),
    };

    this.metricsCache.set(cacheKey, mockMetrics);
    return mockMetrics;
  }

  /**
   * Calculate cache efficiency score
   */
  calculateEfficiencyScore(metrics: MetricsData): number {
    const hitRateScore = metrics.cacheHitRate / 100;
    const latencyScore = Math.max(0, 1 - metrics.originLatency / 1000);
    const errorScore = 1 - metrics.errorRate / 100;

    return (hitRateScore * 0.5 + latencyScore * 0.3 + errorScore * 0.2) * 100;
  }

  /**
   * Get metrics summary for monitoring
   */
  async getMetricsSummary(): Promise<{
    current: MetricsData;
    efficiencyScore: number;
    recommendations: string[];
  }> {
    const current = await this.fetchMetrics();
    const efficiencyScore = this.calculateEfficiencyScore(current);
    const recommendations: string[] = [];

    if (current.cacheHitRate < 80) {
      recommendations.push('Consider increasing cache TTL for frequently accessed content');
    }

    if (current.originLatency > 500) {
      recommendations.push('Origin latency is high - consider optimizing origin server performance');
    }

    if (current.errorRate > 1) {
      recommendations.push('Error rate is elevated - review origin server logs and CloudFront error logs');
    }

    return {
      current,
      efficiencyScore,
      recommendations,
    };
  }

  /**
   * Track custom metric event
   */
  trackEvent(eventType: string, metadata?: Record<string, any>): void {
    console.log(`CDN Event: ${eventType}`, {
      distributionId: this.distributionId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });

    // In production, send to CloudWatch custom metrics or analytics service
  }
}
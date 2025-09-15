import { z } from 'zod';

export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export interface HealthCheckResult {
  status: HealthStatus;
  distribution: {
    id: string;
    enabled: boolean;
    status: string;
  };
  origins: {
    id: string;
    domain: string;
    healthy: boolean;
    latency: number;
  }[];
  cache: {
    hitRate: number;
    errorRate: number;
  };
  timestamp: Date;
  message?: string;
}

export class CDNHealthCheck {
  private distributionId: string;
  private distributionDomain: string;
  private originDomain: string;

  constructor(distributionId: string, distributionDomain: string, originDomain: string) {
    this.distributionId = distributionId;
    this.distributionDomain = distributionDomain;
    this.originDomain = originDomain;
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDistribution(),
      this.checkOrigin(),
      this.checkCachePerformance(),
    ]);

    const distributionCheck = checks[0].status === 'fulfilled' ? checks[0].value : null;
    const originCheck = checks[1].status === 'fulfilled' ? checks[1].value : null;
    const cacheCheck = checks[2].status === 'fulfilled' ? checks[2].value : null;

    const status = this.determineOverallStatus(distributionCheck, originCheck, cacheCheck);

    return {
      status,
      distribution: {
        id: this.distributionId,
        enabled: distributionCheck?.enabled ?? false,
        status: distributionCheck?.status ?? 'unknown',
      },
      origins: [
        {
          id: 'supabase-storage',
          domain: this.originDomain,
          healthy: originCheck?.healthy ?? false,
          latency: originCheck?.latency ?? -1,
        },
      ],
      cache: {
        hitRate: cacheCheck?.hitRate ?? 0,
        errorRate: cacheCheck?.errorRate ?? 100,
      },
      timestamp: new Date(),
      message: this.generateHealthMessage(status),
    };
  }

  /**
   * Check CloudFront distribution status
   */
  private async checkDistribution(): Promise<{
    enabled: boolean;
    status: string;
  }> {
    // In production, use CloudFront API to check distribution status
    // For now, return mock data
    return {
      enabled: true,
      status: 'Deployed',
    };
  }

  /**
   * Check origin health
   */
  private async checkOrigin(): Promise<{
    healthy: boolean;
    latency: number;
  }> {
    const startTime = Date.now();

    try {
      // Perform HEAD request to origin
      const response = await fetch(`https://${this.originDomain}/health`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;

      return {
        healthy: response.ok,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: -1,
      };
    }
  }

  /**
   * Check cache performance metrics
   */
  private async checkCachePerformance(): Promise<{
    hitRate: number;
    errorRate: number;
  }> {
    // In production, fetch from CloudWatch metrics
    // For now, return mock data
    return {
      hitRate: 85,
      errorRate: 0.5,
    };
  }

  /**
   * Determine overall health status based on individual checks
   */
  private determineOverallStatus(
    distribution: any,
    origin: any,
    cache: any
  ): HealthStatus {
    if (!distribution?.enabled || !origin?.healthy) {
      return 'unhealthy';
    }

    if (cache?.hitRate < 70 || cache?.errorRate > 5 || origin?.latency > 1000) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Generate human-readable health message
   */
  private generateHealthMessage(status: HealthStatus): string {
    switch (status) {
      case 'healthy':
        return 'CDN is operating normally';
      case 'degraded':
        return 'CDN is experiencing performance issues';
      case 'unhealthy':
        return 'CDN is experiencing significant issues';
    }
  }

  /**
   * Quick health ping
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`https://${this.distributionDomain}/health`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
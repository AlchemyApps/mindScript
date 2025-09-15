#!/usr/bin/env tsx

import * as Sentry from '@sentry/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Sentry for monitoring script
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 1.0,
});

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

class HealthChecker {
  private results: HealthCheckResult[] = [];
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async checkWebApp(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/health`);
      const responseTime = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        return {
          service: 'web-app',
          status: 'healthy',
          responseTime,
          details: data,
        };
      } else {
        return {
          service: 'web-app',
          status: 'degraded',
          responseTime,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        service: 'web-app',
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('health_check')
        .select('id')
        .limit(1);
      
      const responseTime = Date.now() - start;
      
      if (error) {
        return {
          service: 'database',
          status: 'degraded',
          responseTime,
          error: error.message,
        };
      }
      
      return {
        service: 'database',
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkStorage(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const { data, error } = await this.supabase.storage
        .from('public-assets')
        .list('', { limit: 1 });
      
      const responseTime = Date.now() - start;
      
      if (error) {
        return {
          service: 'storage',
          status: 'degraded',
          responseTime,
          error: error.message,
        };
      }
      
      return {
        service: 'storage',
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        service: 'storage',
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkAudioQueue(): Promise<HealthCheckResult> {
    try {
      const { data, error } = await this.supabase
        .from('audio_jobs')
        .select('status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (error) {
        return {
          service: 'audio-queue',
          status: 'degraded',
          error: error.message,
        };
      }
      
      // Check if oldest pending job is too old (>10 minutes)
      if (data && data.length > 0) {
        const oldestJob = data[0];
        const ageMinutes = (Date.now() - new Date(oldestJob.created_at).getTime()) / 1000 / 60;
        
        if (ageMinutes > 10) {
          return {
            service: 'audio-queue',
            status: 'degraded',
            details: { oldestJobAgeMinutes: ageMinutes },
          };
        }
      }
      
      return {
        service: 'audio-queue',
        status: 'healthy',
      };
    } catch (error) {
      return {
        service: 'audio-queue',
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkExternalServices(): Promise<HealthCheckResult[]> {
    const services = [
      { name: 'stripe', url: 'https://api.stripe.com/v1/health' },
      { name: 'elevenlabs', url: 'https://api.elevenlabs.io/v1/health' },
      { name: 'openai', url: 'https://api.openai.com/v1/health' },
    ];

    const results: HealthCheckResult[] = [];

    for (const service of services) {
      const start = Date.now();
      try {
        const response = await fetch(service.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'MindScript-HealthCheck/1.0',
          },
        });
        
        const responseTime = Date.now() - start;
        
        results.push({
          service: service.name,
          status: response.ok ? 'healthy' : 'degraded',
          responseTime,
        });
      } catch (error) {
        results.push({
          service: service.name,
          status: 'down',
          error: 'Connection failed',
        });
      }
    }

    return results;
  }

  async runAllChecks(): Promise<{
    timestamp: string;
    overall_status: 'healthy' | 'degraded' | 'down';
    results: HealthCheckResult[];
  }> {
    const results: HealthCheckResult[] = [];

    // Run all checks in parallel
    const [webApp, database, storage, audioQueue, ...externalServices] = await Promise.all([
      this.checkWebApp(),
      this.checkDatabase(),
      this.checkStorage(),
      this.checkAudioQueue(),
      this.checkExternalServices(),
    ]);

    results.push(webApp, database, storage, audioQueue, ...externalServices.flat());

    // Determine overall status
    const hasDown = results.some(r => r.status === 'down');
    const hasDegraded = results.some(r => r.status === 'degraded');
    
    let overall_status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (hasDown) overall_status = 'down';
    else if (hasDegraded) overall_status = 'degraded';

    // Send to Sentry if not healthy
    if (overall_status !== 'healthy') {
      Sentry.captureMessage(`Health check ${overall_status}`, {
        level: overall_status === 'down' ? 'error' : 'warning',
        extra: { results },
      });
    }

    // Store in database
    await this.supabase
      .from('health_checks')
      .insert({
        timestamp: new Date().toISOString(),
        overall_status,
        results,
      });

    return {
      timestamp: new Date().toISOString(),
      overall_status,
      results,
    };
  }
}

// Run health check
async function main() {
  const checker = new HealthChecker();
  const result = await checker.runAllChecks();
  
  console.log(JSON.stringify(result, null, 2));
  
  // Exit with appropriate code
  process.exit(result.overall_status === 'healthy' ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Health check failed:', error);
    Sentry.captureException(error);
    process.exit(1);
  });
}
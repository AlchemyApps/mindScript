import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: boolean;
    storage: boolean;
    auth: boolean;
  };
  version: string;
  environment: string;
}

export async function GET() {
  const startTime = Date.now();
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: false,
      storage: false,
      auth: false,
    },
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown',
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  };

  try {
    // Only check services if environment variables are set
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Check database
      try {
        const { error } = await supabase
          .from('health_check')
          .select('id')
          .limit(1)
          .single();
        
        health.services.database = !error;
      } catch {
        health.services.database = false;
      }

      // Check auth
      try {
        const { data: { session } } = await supabase.auth.getSession();
        health.services.auth = true; // Auth service is reachable
      } catch {
        health.services.auth = false;
      }

      // Check storage
      try {
        const { error } = await supabase.storage
          .from('public-assets')
          .list('', { limit: 1 });
        
        health.services.storage = !error;
      } catch {
        health.services.storage = false;
      }
    }

    // Determine overall status
    const allHealthy = Object.values(health.services).every(s => s === true);
    const someHealthy = Object.values(health.services).some(s => s === true);
    
    if (!someHealthy) {
      health.status = 'down';
    } else if (!allHealthy) {
      health.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;

    // Log to Sentry if not healthy
    if (health.status !== 'healthy') {
      Sentry.captureMessage(`Health check ${health.status}`, {
        level: health.status === 'down' ? 'error' : 'warning',
        extra: health,
      });
    }

    return NextResponse.json(
      {
        ...health,
        responseTime,
      },
      {
        status: health.status === 'healthy' ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    Sentry.captureException(error);
    
    return NextResponse.json(
      {
        status: 'down',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
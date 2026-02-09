import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { verifyRenderOwnership, getRenderJobStatus } from '@/lib/render-utils';
import { createUserRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const renderId = params.id;
    
    // Validate render ID format
    if (!renderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(renderId)) {
      return NextResponse.json(
        { error: 'Invalid render ID format' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Apply rate limiting
    const rateLimiter = createUserRateLimit(user.id, RATE_LIMITS.status);
    const rateLimit = rateLimiter(request);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retry_after: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'x-ratelimit-limit': RATE_LIMITS.status.max.toString(),
            'x-ratelimit-remaining': rateLimit.remaining.toString(),
            'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
          },
        }
      );
    }

    // Verify render ownership
    const ownsRender = await verifyRenderOwnership(renderId, user.id);
    if (!ownsRender) {
      return NextResponse.json(
        { error: 'You do not own this render job' },
        { status: 403 }
      );
    }

    // Get render job status
    let renderJob;
    try {
      renderJob = await getRenderJobStatus(renderId);
    } catch (error) {
      console.error('Failed to get render job status:', error);
      return NextResponse.json(
        { error: 'Render job not found' },
        { status: 404 }
      );
    }

    // Transform response to match schema
    const response = {
      id: renderJob.id,
      track_id: renderJob.track_id,
      status: renderJob.status,
      progress: renderJob.progress,
      stage: renderJob.stage || undefined,
      error: renderJob.error || undefined,
      result: renderJob.result || undefined,
      created_at: new Date(renderJob.created_at).toISOString(),
      updated_at: new Date(renderJob.updated_at).toISOString(),
    };

    // Return status with poll-friendly cache headers
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'cache-control': 'no-cache', // Prevent caching for real-time updates
        'x-ratelimit-limit': RATE_LIMITS.status.max.toString(),
        'x-ratelimit-remaining': rateLimit.remaining.toString(),
        'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
      },
    });
  } catch (error) {
    console.error('Render status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
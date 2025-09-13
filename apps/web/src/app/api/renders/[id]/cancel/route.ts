import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CancelRenderSchema } from '@mindscript/schemas';
import {
  verifyRenderOwnership,
  getRenderJobStatus,
  cancelRenderJob,
} from '../../../../lib/render-utils';
import { createUserRateLimit, RATE_LIMITS } from '../../../../lib/rate-limit';

export async function POST(
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
    const rateLimiter = createUserRateLimit(user.id, RATE_LIMITS.cancel);
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
            'x-ratelimit-limit': RATE_LIMITS.cancel.max.toString(),
            'x-ratelimit-remaining': rateLimit.remaining.toString(),
            'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
          },
        }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = CancelRenderSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.errors,
        },
        { status: 400 }
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

    // Get current render job status
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

    // Check if render job can be cancelled
    const cancellableStatuses = ['pending', 'processing'];
    if (!cancellableStatuses.includes(renderJob.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel render job with status: ${renderJob.status}`,
          current_status: renderJob.status,
        },
        { status: 409 }
      );
    }

    // Cancel the render job
    let cancelledJob;
    try {
      cancelledJob = await cancelRenderJob(renderId);
    } catch (error) {
      console.error('Failed to cancel render job:', error);
      return NextResponse.json(
        { error: 'Failed to cancel render job' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Render job cancelled successfully',
        render: {
          id: cancelledJob.id,
          status: cancelledJob.status,
          updated_at: cancelledJob.updated_at,
        },
      },
      {
        status: 200,
        headers: {
          'x-ratelimit-limit': RATE_LIMITS.cancel.max.toString(),
          'x-ratelimit-remaining': rateLimit.remaining.toString(),
          'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('Cancel render error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
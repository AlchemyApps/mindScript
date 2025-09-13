import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RenderRequestSchema } from '@mindscript/schemas';
import {
  verifyTrackOwnership,
  getExistingRenderJob,
  createRenderJob,
  invokeRenderProcessor,
} from '../../../lib/render-utils';
import { createUserRateLimit, RATE_LIMITS } from '../../../lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id;
    
    // Validate track ID format
    if (!trackId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId)) {
      return NextResponse.json(
        { error: 'Invalid track ID format' },
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
    const rateLimiter = createUserRateLimit(user.id, RATE_LIMITS.render);
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
            'x-ratelimit-limit': RATE_LIMITS.render.max.toString(),
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

    const validationResult = RenderRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { quality, format } = validationResult.data;

    // Verify track ownership
    const ownsTrack = await verifyTrackOwnership(trackId, user.id);
    if (!ownsTrack) {
      return NextResponse.json(
        { error: 'You do not own this track' },
        { status: 403 }
      );
    }

    // Check for existing render jobs
    const existingJob = await getExistingRenderJob(trackId, user.id);
    if (existingJob) {
      return NextResponse.json(
        {
          error: 'Render job already in progress',
          existing_render: {
            id: existingJob.id,
            status: existingJob.status,
            progress: existingJob.progress,
            created_at: existingJob.created_at,
          },
        },
        { status: 409 }
      );
    }

    // Create render job
    const jobData = {
      quality,
      format,
      requested_at: new Date().toISOString(),
    };

    const renderJob = await createRenderJob({
      trackId,
      userId: user.id,
      jobData,
    });

    // Invoke Edge Function for processing (async)
    try {
      await invokeRenderProcessor(renderJob.id);
    } catch (error) {
      // If processor invocation fails, we should still return the job
      // but log the error for monitoring
      console.error('Failed to invoke render processor:', error);
      
      // Return error to user since the job won't be processed
      return NextResponse.json(
        { error: 'Failed to start render job' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        render: {
          id: renderJob.id,
          status: renderJob.status,
          progress: renderJob.progress,
          created_at: renderJob.created_at,
        },
        message: 'Render job submitted successfully',
      },
      {
        status: 201,
        headers: {
          'x-ratelimit-limit': RATE_LIMITS.render.max.toString(),
          'x-ratelimit-remaining': rateLimit.remaining.toString(),
          'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('Render job creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { DownloadOptionsSchema } from '@mindscript/schemas';
import {
  verifyTrackOwnership,
  getTrackDownloadInfo,
  generateDownloadUrl,
  incrementDownloadCount,
} from '../../../lib/render-utils';
import { createUserRateLimit, RATE_LIMITS } from '../../../lib/rate-limit';

export async function GET(
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
    const rateLimiter = createUserRateLimit(user.id, RATE_LIMITS.download);
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
            'x-ratelimit-limit': RATE_LIMITS.download.max.toString(),
            'x-ratelimit-remaining': rateLimit.remaining.toString(),
            'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
          },
        }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const downloadOptions = {
      expires_in: searchParams.get('expires_in') ? parseInt(searchParams.get('expires_in')!) : undefined,
    };

    // Validate download options
    const validationResult = DownloadOptionsSchema.safeParse(downloadOptions);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { expires_in } = validationResult.data;

    // Verify track ownership
    const ownsTrack = await verifyTrackOwnership(trackId, user.id);
    if (!ownsTrack) {
      return NextResponse.json(
        { error: 'You do not own this track' },
        { status: 403 }
      );
    }

    // Get track download info
    let trackInfo;
    try {
      trackInfo = await getTrackDownloadInfo(trackId);
    } catch (error) {
      console.error('Failed to get track download info:', error);
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // Check if audio file is available and track is completed
    if (!trackInfo.audio_url) {
      return NextResponse.json(
        { error: 'Audio file not available' },
        { status: 404 }
      );
    }

    // Generate signed URL
    let signedUrl;
    try {
      signedUrl = await generateDownloadUrl(trackInfo.audio_url, expires_in);
    } catch (error) {
      console.error('Failed to generate download URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    // Increment download count (non-blocking, errors are logged but don't affect response)
    incrementDownloadCount(trackId).catch(error => {
      console.error('Failed to increment download count:', error);
    });

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Return download URL
    return NextResponse.json(
      {
        download_url: signedUrl,
        expires_at: expiresAt.toISOString(),
        expires_in,
      },
      {
        status: 200,
        headers: {
          'accept-ranges': 'bytes', // Support range requests for streaming
          'x-ratelimit-limit': RATE_LIMITS.download.max.toString(),
          'x-ratelimit-remaining': rateLimit.remaining.toString(),
          'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
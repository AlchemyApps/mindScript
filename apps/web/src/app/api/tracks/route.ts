import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  CreateTrackSchema, 
  ListTracksSchema, 
  validateTrackConfig,
  PaginatedTracksSchema 
} from '@mindscript/schemas';
import { 
  getAuthenticatedUser, 
  buildTrackQuery, 
  transformTrackForResponse, 
  generateCursor,
  validateTrackConfiguration,
  checkRateLimit
} from './utils';
import { createServerClient } from '@mindscript/auth/server';

/**
 * GET /api/tracks - List tracks with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      cursor: searchParams.get('cursor') || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      status: searchParams.get('status') || undefined,
      owner_id: searchParams.get('owner_id') || undefined,
      tags: searchParams.getAll('tags'),
      sort: searchParams.get('sort') || 'created_at',
      order: searchParams.get('order') || 'desc',
      is_public: searchParams.get('is_public') ? 
        searchParams.get('is_public') === 'true' : undefined,
    };

    // Validate query parameters
    const validatedParams = ListTracksSchema.parse(queryParams);

    // Get authenticated user (optional for public tracks)
    const { user } = await getAuthenticatedUser();
    
    // If no user and not explicitly requesting public tracks, return empty result
    if (!user && validatedParams.is_public === undefined) {
      return NextResponse.json({
        data: [],
        pagination: {
          limit: validatedParams.limit,
          has_next: false,
          has_prev: false,
          total_count: 0,
        },
      });
    }

    // Build and execute query
    const supabase = await createServerClient();
    const query = buildTrackQuery(supabase, validatedParams, user?.id);
    
    const { data: tracks, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tracks' },
        { status: 500 }
      );
    }

    if (!tracks) {
      return NextResponse.json({
        data: [],
        pagination: {
          limit: validatedParams.limit,
          has_next: false,
          has_prev: false,
          total_count: 0,
        },
      });
    }

    // Transform tracks for response
    const transformedTracks = tracks.map(transformTrackForResponse);

    // Pagination info
    const hasNext = tracks.length === validatedParams.limit;
    const cursor = hasNext && tracks.length > 0 ? 
      generateCursor(tracks[tracks.length - 1]) : undefined;

    const response = {
      data: transformedTracks,
      pagination: {
        limit: validatedParams.limit,
        cursor,
        has_next: hasNext,
        has_prev: !!validatedParams.cursor,
        total_count: count || undefined,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error fetching tracks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tracks - Create new track
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication required for creating tracks
    const { user, error: authError } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit
    const { allowed, error: rateLimitError } = await checkRateLimit(user.id, 'create');
    if (!allowed) {
      return NextResponse.json(
        { error: rateLimitError },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = CreateTrackSchema.parse(body);

    // Additional business rule validation
    const configValidation = validateTrackConfiguration(validatedData);
    if (!configValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid track configuration', details: configValidation.errors },
        { status: 400 }
      );
    }

    // Validate track configuration (from schemas)
    try {
      validateTrackConfig(validatedData);
    } catch (validationError) {
      return NextResponse.json(
        { error: (validationError as Error).message },
        { status: 400 }
      );
    }

    // Create track record
    const supabase = await createServerClient();
    const trackData = {
      ...validatedData,
      user_id: user.id,
      status: 'draft',
      is_public: validatedData.output_config.is_public || false,
      play_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdTrack, error: insertError } = await supabase
      .from('tracks')
      .insert([trackData])
      .select(`
        *,
        profiles!tracks_user_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (insertError || !createdTrack) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create track' },
        { status: 500 }
      );
    }

    // Transform for response
    const responseTrack = transformTrackForResponse(createdTrack);

    return NextResponse.json(responseTrack, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating track:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
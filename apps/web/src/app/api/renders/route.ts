import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ListRendersSchema } from '@mindscript/schemas';
import { supabaseAdmin } from '../lib/render-utils';

export async function GET(request: NextRequest) {
  try {
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

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      status: searchParams.get('status') || undefined,
      track_id: searchParams.get('track_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    };

    const validationResult = ListRendersSchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { cursor, limit, status, track_id, start_date, end_date } = validationResult.data;

    // Build query
    let query = supabaseAdmin
      .from('audio_job_queue')
      .select(`
        id,
        track_id,
        status,
        progress,
        stage,
        result,
        error,
        created_at,
        updated_at,
        track:tracks!inner(
          id,
          title,
          duration_seconds
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to determine has_next

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (track_id) {
      query = query.eq('track_id', track_id);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply cursor pagination
    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    // Execute query
    const { data: rawRenders, error } = await query;

    if (error) {
      console.error('Database error fetching renders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch renders' },
        { status: 500 }
      );
    }

    // Process pagination
    const hasNext = rawRenders.length > limit;
    const renders = hasNext ? rawRenders.slice(0, limit) : rawRenders;
    
    const newCursor = renders.length > 0 ? renders[renders.length - 1].created_at : undefined;
    const hasPrev = !!cursor;

    // Transform response data
    const transformedRenders = renders.map(render => ({
      id: render.id,
      track_id: render.track_id,
      status: render.status,
      progress: render.progress,
      stage: render.stage || undefined,
      error: render.error || undefined,
      result: render.result || undefined,
      created_at: new Date(render.created_at).toISOString(),
      updated_at: new Date(render.updated_at).toISOString(),
      track: render.track,
    }));

    // Return paginated response
    return NextResponse.json({
      data: transformedRenders,
      pagination: {
        limit,
        cursor: newCursor,
        has_next: hasNext,
        has_prev: hasPrev,
        total_count: undefined, // Not calculated for performance
      },
    });
  } catch (error) {
    console.error('List renders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
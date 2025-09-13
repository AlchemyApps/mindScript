import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UpdateTrackSchema } from '@mindscript/schemas';
import { 
  getAuthenticatedUser, 
  checkTrackOwnership, 
  checkTrackAccess,
  transformTrackForResponse,
  deleteTrackFiles,
  validateTrackConfiguration
} from '../utils';
import { createServerClient } from '@mindscript/auth/server';

/**
 * GET /api/tracks/[id] - Get single track details
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id;

    // Get user (optional for public tracks)
    const { user } = await getAuthenticatedUser();

    // Check if user can access this track
    const { track, authorized, error: accessError } = await checkTrackAccess(
      trackId, 
      user?.id
    );

    if (!authorized || !track) {
      return NextResponse.json(
        { error: accessError || 'Track not found' },
        { status: authorized === false ? 403 : 404 }
      );
    }

    // Get full track details with render status
    const supabase = await createServerClient();
    const { data: fullTrack, error } = await supabase
      .from('tracks')
      .select(`
        *,
        profiles!tracks_user_id_fkey (
          id,
          display_name,
          avatar_url
        ),
        renders!tracks_render_job_id_fkey (
          id,
          status
        )
      `)
      .eq('id', trackId)
      .is('deleted_at', null)
      .single();

    if (error || !fullTrack) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // Transform for response
    const responseTrack = transformTrackForResponse(fullTrack);

    return NextResponse.json(responseTrack);
  } catch (error) {
    console.error('Error fetching track:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tracks/[id] - Update track metadata
 */
export async function PUT(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id;

    // Authentication required
    const { user, error: authError } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check ownership
    const { authorized, error: ownershipError } = await checkTrackOwnership(
      trackId, 
      user.id
    );
    if (!authorized) {
      return NextResponse.json(
        { error: ownershipError || 'Permission denied' },
        { status: ownershipError === 'Track not found' ? 404 : 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = UpdateTrackSchema.parse(body);

    // If no updates provided, return current track
    if (Object.keys(validatedData).length === 0) {
      const supabase = await createServerClient();
      const { data: track, error } = await supabase
        .from('tracks')
        .select(`
          *,
          profiles!tracks_user_id_fkey (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('id', trackId)
        .single();

      if (error || !track) {
        return NextResponse.json(
          { error: 'Track not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(transformTrackForResponse(track));
    }

    // Update track
    const updateData = {
      ...validatedData,
      updated_at: new Date().toISOString(),
    };

    const supabase = await createServerClient();
    const { data: updatedTrack, error: updateError } = await supabase
      .from('tracks')
      .update(updateData)
      .eq('id', trackId)
      .eq('user_id', user.id) // Double-check ownership
      .select(`
        *,
        profiles!tracks_user_id_fkey (
          id,
          display_name,
          avatar_url
        ),
        renders!tracks_render_job_id_fkey (
          id,
          status
        )
      `)
      .single();

    if (updateError || !updatedTrack) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update track' },
        { status: 500 }
      );
    }

    // Transform for response
    const responseTrack = transformTrackForResponse(updatedTrack);

    return NextResponse.json(responseTrack);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating track:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tracks/[id] - Soft delete track
 */
export async function DELETE(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id;

    // Authentication required
    const { user, error: authError } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check ownership and get track data
    const supabase = await createServerClient();
    const { data: tracks, error: fetchError } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', trackId)
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (fetchError) {
      console.error('Database fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch track' },
        { status: 500 }
      );
    }

    if (!tracks || tracks.length === 0) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    const track = tracks[0];

    // Soft delete the track
    const { error: deleteError } = await supabase
      .from('tracks')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', trackId)
      .eq('user_id', user.id); // Double-check ownership

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete track' },
        { status: 500 }
      );
    }

    // Clean up associated files in the background
    // Don't wait for this to complete to avoid blocking the response
    deleteTrackFiles(track).catch(error => {
      console.error('Error cleaning up track files:', error);
      // In production, you might want to queue this for retry
    });

    return NextResponse.json(
      { message: 'Track deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting track:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schema for adding tracks to playlist
const addTracksSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(1).max(100),
});

// Schema for reordering tracks
const reorderTracksSchema = z.object({
  trackId: z.string().uuid(),
  newPosition: z.number().int().min(0),
});

// Schema for removing tracks
const removeTracksSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(1),
});

// POST /api/library/playlists/[id]/tracks - Add tracks to playlist
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const playlistId = params.id;
    
    // Validate playlist ownership
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, user_id')
      .eq('id', playlistId)
      .eq('user_id', user.id)
      .single();

    if (playlistError || !playlist) {
      return NextResponse.json(
        { error: 'Playlist not found or unauthorized' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { trackIds } = addTracksSchema.parse(body);

    // Verify tracks exist and user has access
    const { data: tracks, error: tracksError } = await supabase
      .from('tracks')
      .select('id')
      .in('id', trackIds);

    if (tracksError || !tracks || tracks.length !== trackIds.length) {
      return NextResponse.json(
        { error: 'One or more tracks not found' },
        { status: 400 }
      );
    }

    // Check which tracks user has access to
    const { data: ownedTracks } = await supabase
      .from('tracks')
      .select('id')
      .eq('owner_id', user.id)
      .in('id', trackIds);

    const ownedTrackIds = new Set(ownedTracks?.map(t => t.id) || []);

    // For non-owned tracks, check purchase access
    const nonOwnedTrackIds = trackIds.filter(id => !ownedTrackIds.has(id));
    
    if (nonOwnedTrackIds.length > 0) {
      const { data: purchasedAccess } = await supabase
        .from('track_access')
        .select('track_id')
        .eq('user_id', user.id)
        .in('track_id', nonOwnedTrackIds);

      const purchasedTrackIds = new Set(purchasedAccess?.map(a => a.track_id) || []);
      const unauthorizedTracks = nonOwnedTrackIds.filter(id => !purchasedTrackIds.has(id));

      if (unauthorizedTracks.length > 0) {
        return NextResponse.json(
          { error: 'You do not have access to some of the tracks' },
          { status: 403 }
        );
      }
    }

    // Get current max position
    const { data: maxPositionData } = await supabase
      .from('playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    let nextPosition = maxPositionData ? maxPositionData.position + 1 : 0;

    // Check for existing tracks in playlist
    const { data: existingTracks } = await supabase
      .from('playlist_tracks')
      .select('track_id')
      .eq('playlist_id', playlistId)
      .in('track_id', trackIds);

    const existingTrackIds = new Set(existingTracks?.map(t => t.track_id) || []);
    const newTrackIds = trackIds.filter(id => !existingTrackIds.has(id));

    if (newTrackIds.length === 0) {
      return NextResponse.json(
        { error: 'All tracks are already in the playlist' },
        { status: 409 }
      );
    }

    // Add new tracks to playlist
    const playlistTracks = newTrackIds.map((trackId, index) => ({
      playlist_id: playlistId,
      track_id: trackId,
      position: nextPosition + index,
      added_by: user.id,
    }));

    const { error: insertError } = await supabase
      .from('playlist_tracks')
      .insert(playlistTracks);

    if (insertError) {
      console.error('Error adding tracks to playlist:', insertError);
      return NextResponse.json(
        { error: 'Failed to add tracks to playlist' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Tracks added successfully',
      added: newTrackIds.length,
      skipped: existingTrackIds.size,
    });
  } catch (error) {
    console.error('Error in POST /api/library/playlists/[id]/tracks:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/library/playlists/[id]/tracks - Reorder tracks in playlist
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const playlistId = params.id;
    
    // Parse and validate request body
    const body = await request.json();
    const { trackId, newPosition } = reorderTracksSchema.parse(body);

    // Call the reorder function
    const { error } = await supabase.rpc('reorder_playlist_tracks', {
      p_playlist_id: playlistId,
      p_track_id: trackId,
      p_new_position: newPosition,
    });

    if (error) {
      console.error('Error reordering tracks:', error);
      
      if (error.message?.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'You do not own this playlist' },
          { status: 403 }
        );
      }
      
      if (error.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Track not found in playlist' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to reorder tracks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Track reordered successfully' });
  } catch (error) {
    console.error('Error in PUT /api/library/playlists/[id]/tracks:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/library/playlists/[id]/tracks - Remove tracks from playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const playlistId = params.id;
    
    // Validate playlist ownership
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, user_id')
      .eq('id', playlistId)
      .eq('user_id', user.id)
      .single();

    if (playlistError || !playlist) {
      return NextResponse.json(
        { error: 'Playlist not found or unauthorized' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { trackIds } = removeTracksSchema.parse(body);

    // Remove tracks from playlist
    const { error: deleteError } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .in('track_id', trackIds);

    if (deleteError) {
      console.error('Error removing tracks from playlist:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove tracks from playlist' },
        { status: 500 }
      );
    }

    // Reorder remaining tracks to fill gaps
    const { data: remainingTracks } = await supabase
      .from('playlist_tracks')
      .select('id, position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    if (remainingTracks && remainingTracks.length > 0) {
      // Update positions to be sequential
      const updates = remainingTracks.map((track, index) => ({
        id: track.id,
        position: index,
      }));

      for (const update of updates) {
        if (update.position !== remainingTracks.find(t => t.id === update.id)?.position) {
          await supabase
            .from('playlist_tracks')
            .update({ position: update.position })
            .eq('id', update.id);
        }
      }
    }

    return NextResponse.json({ 
      message: 'Tracks removed successfully',
      removed: trackIds.length,
    });
  } catch (error) {
    console.error('Error in DELETE /api/library/playlists/[id]/tracks:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
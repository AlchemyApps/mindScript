import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { usernameCheckSchema, validateUsername, isUsernameReserved } from '@mindscript/schemas';
import { z } from 'zod';

/**
 * POST /api/profile/check-username - Check username availability
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = usernameCheckSchema.parse(body);
    const { username } = validatedData;

    // Validate username format
    const validation = validateUsername(username);
    if (!validation.valid) {
      return NextResponse.json({
        available: false,
        error: validation.error
      });
    }

    // Check if username is reserved
    if (isUsernameReserved(username)) {
      return NextResponse.json({
        available: false,
        error: 'This username is reserved'
      });
    }

    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();

    // Check if username is already taken
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error('Username check error:', checkError);
      return NextResponse.json(
        { error: 'Failed to check username availability' },
        { status: 500 }
      );
    }

    // Username is available if:
    // 1. No profile exists with this username, OR
    // 2. The profile with this username belongs to the current user
    const isAvailable = !existingProfile || (user && existingProfile.id === user.id);

    return NextResponse.json({
      available: isAvailable,
      username: username.toLowerCase(),
      error: isAvailable ? null : 'Username is already taken'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          available: false,
          error: 'Invalid username format',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    console.error('Error checking username:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
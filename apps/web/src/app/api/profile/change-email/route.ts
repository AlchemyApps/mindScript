import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { emailChangeRequestSchema } from '@mindscript/schemas';
import { z } from 'zod';

/**
 * POST /api/profile/change-email - Request email change
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = emailChangeRequestSchema.parse(body);

    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validatedData.password
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Check if new email is already in use
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', validatedData.new_email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email address is already in use' },
        { status: 400 }
      );
    }

    // Request email change
    const { error: updateError } = await supabase.auth.updateUser({
      email: validatedData.new_email
    });

    if (updateError) {
      console.error('Email update error:', updateError);
      
      // Handle specific error cases
      if (updateError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Email address is already in use' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: updateError.message || 'Failed to update email' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Email change requested. Please check your new email address for a confirmation link.',
      new_email: validatedData.new_email
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error changing email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
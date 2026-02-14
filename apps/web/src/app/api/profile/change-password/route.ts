import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { passwordChangeRequestSchema } from '@mindscript/schemas';
import { z } from 'zod';

/**
 * POST /api/profile/change-password - Change password
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
    const validatedData = passwordChangeRequestSchema.parse(body);

    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validatedData.current_password
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: validatedData.new_password
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      
      // Handle specific error cases
      if (updateError.message.includes('same as the old')) {
        return NextResponse.json(
          { error: 'New password must be different from current password' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password' },
        { status: 400 }
      );
    }

    // Log password change event (audit trail)
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'password_changed',
        metadata: {
          timestamp: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        }
      });
    if (auditError) {
      // Don't fail the request if audit log fails
      console.error('Failed to log password change:', auditError);
    }

    return NextResponse.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
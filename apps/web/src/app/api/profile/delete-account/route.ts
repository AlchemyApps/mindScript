import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { accountDeletionRequestSchema } from '@mindscript/schemas';
import { z } from 'zod';

/**
 * POST /api/profile/delete-account - Delete user account
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
    const validatedData = accountDeletionRequestSchema.parse(body);

    // Verify password
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

    // Check for active subscriptions or pending payments
    const { data: activeSubscriptions } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      return NextResponse.json(
        { error: 'Please cancel all active subscriptions before deleting your account' },
        { status: 400 }
      );
    }

    // Check for pending renders
    const { data: pendingRenders } = await supabase
      .from('audio_renders')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (pendingRenders && pendingRenders.length > 0) {
      return NextResponse.json(
        { error: 'Please wait for all pending renders to complete before deleting your account' },
        { status: 400 }
      );
    }

    // Log account deletion request with reason
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'account_deletion_requested',
        metadata: {
          reason: validatedData.reason,
          timestamp: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        }
      })
      .catch(error => {
        console.error('Failed to log deletion request:', error);
      });

    // Anonymize user data instead of hard delete
    const anonymizedEmail = `deleted_${user.id}@mindscript.deleted`;
    
    // Update profile to anonymized state
    await supabase
      .from('profiles')
      .update({
        email: anonymizedEmail,
        display_name: 'Deleted User',
        username: null,
        bio: null,
        avatar_url: null,
        stripe_customer_id: null,
        role_flags: { is_admin: false, is_seller: false },
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Delete user preferences
    await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', user.id);

    // Delete seller agreement if exists
    await supabase
      .from('seller_agreements')
      .delete()
      .eq('user_id', user.id);

    // Delete avatar from storage if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (profile?.avatar_url) {
      const filePath = profile.avatar_url.split('/').slice(-2).join('/');
      await supabase.storage
        .from('avatars')
        .remove([filePath])
        .catch(error => {
          console.error('Failed to delete avatar:', error);
        });
    }

    // Finally, delete the auth user
    // This will trigger CASCADE deletes for related records
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('User deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    // Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json({
      message: 'Account deleted successfully. We\'re sorry to see you go.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
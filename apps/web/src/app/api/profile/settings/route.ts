import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { settingsUpdateSchema } from '@mindscript/schemas';
import { z } from 'zod';

/**
 * PUT /api/profile/settings - Update user settings
 */
export async function PUT(request: NextRequest) {
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
    const validatedData = settingsUpdateSchema.parse(body);

    // Prepare update object
    const updateData: any = {
      user_id: user.id,
      updated_at: new Date().toISOString()
    };

    if (validatedData.theme !== undefined) {
      updateData.theme = validatedData.theme;
    }

    if (validatedData.notification_settings !== undefined) {
      // Merge with existing notification settings
      const { data: currentPrefs } = await supabase
        .from('user_preferences')
        .select('notification_settings')
        .eq('user_id', user.id)
        .single();

      updateData.notification_settings = {
        ...(currentPrefs?.notification_settings || {}),
        ...validatedData.notification_settings
      };
    }

    if (validatedData.privacy_settings !== undefined) {
      // Merge with existing privacy settings
      const { data: currentPrefs } = await supabase
        .from('user_preferences')
        .select('privacy_settings')
        .eq('user_id', user.id)
        .single();

      updateData.privacy_settings = {
        ...(currentPrefs?.privacy_settings || {}),
        ...validatedData.privacy_settings
      };
    }

    // Upsert preferences
    const { data: updatedPrefs, error: updateError } = await supabase
      .from('user_preferences')
      .upsert(updateData, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (updateError) {
      console.error('Settings update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      theme: updatedPrefs.theme,
      notification_settings: updatedPrefs.notification_settings,
      privacy_settings: updatedPrefs.privacy_settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
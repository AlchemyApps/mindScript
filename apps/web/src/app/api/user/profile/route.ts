import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@mindscript/auth/server';
import { ProfileUpdateSchema } from '@mindscript/schemas';

export const GET = withAuth(async (request, { user }) => {
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile,
      preferences: user.preferences,
    },
  });
});

export const PUT = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const validated = ProfileUpdateSchema.parse(body);

    // Here you would update the profile in the database
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: validated,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
});
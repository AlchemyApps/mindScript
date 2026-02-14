import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@mindscript/auth/server';
import { ProfileUpdateSchema } from '@mindscript/schemas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET: any = withAuth(async (request: any, { user }: any) => {
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile,
      preferences: user.preferences,
    },
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PUT: any = withAuth(async (request: any, { user }: any) => {
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

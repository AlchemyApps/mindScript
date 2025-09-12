import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, getServerUserWithProfile } from './session';
import type { AuthUserWithProfile } from '@mindscript/types';

type RouteHandler<T = unknown> = (
  request: NextRequest,
  context: {
    params: T;
    user: AuthUserWithProfile;
  }
) => Promise<Response> | Response;

type RouteHandlerWithoutAuth<T = unknown> = (
  request: NextRequest,
  context: {
    params: T;
  }
) => Promise<Response> | Response;

export function withAuth<T = unknown>(handler: RouteHandler<T>): RouteHandlerWithoutAuth<T> {
  return async (request: NextRequest, context: { params: T }) => {
    try {
      const user = await getServerUserWithProfile();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      return handler(request, { ...context, user });
    } catch (error) {
      console.error('Auth error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

export function withOptionalAuth<T = unknown>(
  handler: (
    request: NextRequest,
    context: {
      params: T;
      user: AuthUserWithProfile | null;
    }
  ) => Promise<Response> | Response
): RouteHandlerWithoutAuth<T> {
  return async (request: NextRequest, context: { params: T }) => {
    try {
      const user = await getServerUserWithProfile();
      return handler(request, { ...context, user });
    } catch (error) {
      // If auth fails, proceed with null user
      return handler(request, { ...context, user: null });
    }
  };
}

export function withAdminAuth<T = unknown>(handler: RouteHandler<T>): RouteHandlerWithoutAuth<T> {
  return async (request: NextRequest, context: { params: T }) => {
    try {
      const user = await getServerUserWithProfile();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      if (!user.profile?.roleFlags?.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }

      return handler(request, { ...context, user });
    } catch (error) {
      console.error('Auth error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

export function withSellerAuth<T = unknown>(handler: RouteHandler<T>): RouteHandlerWithoutAuth<T> {
  return async (request: NextRequest, context: { params: T }) => {
    try {
      const user = await getServerUserWithProfile();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      if (!user.profile?.roleFlags?.isSeller) {
        return NextResponse.json(
          { error: 'Forbidden - Seller access required' },
          { status: 403 }
        );
      }

      return handler(request, { ...context, user });
    } catch (error) {
      console.error('Auth error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}
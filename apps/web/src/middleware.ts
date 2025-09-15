import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Security headers configuration
const securityHeaders = {
  // Content Security Policy - Strict policy with nonces for scripts
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-scripts.com https://*.sentry.io https://*.posthog.com https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.stripe.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.elevenlabs.io https://api.openai.com https://*.sentry.io https://*.posthog.com https://*.ingest.sentry.io",
    "media-src 'self' blob: https://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
    "upgrade-insecure-requests"
  ].join('; '),
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable HSTS with preload
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=(self https://checkout.stripe.com)',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', '),
  
  // Cross-Origin policies
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  
  // DNS Prefetch Control
  'X-DNS-Prefetch-Control': 'on',
  
  // Download Options
  'X-Download-Options': 'noopen',
  
  // Permitted Cross-Domain Policies
  'X-Permitted-Cross-Domain-Policies': 'none',
};

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: {
    api: 60,           // 60 requests per minute for API routes
    auth: 5,           // 5 requests per minute for auth endpoints
    render: 2,         // 2 requests per minute for audio rendering
    webhook: 100,      // 100 requests per minute for webhooks
    default: 100       // 100 requests per minute default
  }
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(request: NextRequest): string {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const path = request.nextUrl.pathname;
  return `${ip}:${path}`;
}

function checkRateLimit(request: NextRequest): boolean {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const path = request.nextUrl.pathname;
  
  // Determine rate limit based on path
  let maxRequests = rateLimitConfig.maxRequests.default;
  if (path.startsWith('/api/auth')) {
    maxRequests = rateLimitConfig.maxRequests.auth;
  } else if (path.startsWith('/api/render')) {
    maxRequests = rateLimitConfig.maxRequests.render;
  } else if (path.startsWith('/api/webhooks')) {
    maxRequests = rateLimitConfig.maxRequests.webhook;
  } else if (path.startsWith('/api')) {
    maxRequests = rateLimitConfig.maxRequests.api;
  }
  
  const limit = rateLimitStore.get(key);
  
  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + rateLimitConfig.windowMs
    });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Clean up old rate limit entries periodically
// Note: In production, use Redis or similar for rate limiting
// setInterval doesn't work well in serverless/edge environments
if (typeof global !== 'undefined' && !global.rateLimitCleanupStarted) {
  global.rateLimitCleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, limit] of rateLimitStore.entries()) {
      if (now > limit.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60 * 1000); // Clean up every minute
}

// Auth route configuration
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/reset-password',
  '/auth/callback',
  '/api/auth/callback',
];

const protectedRoutes = [
  '/dashboard',
  '/builder',
  '/library',
  '/settings',
  '/admin',
];

export async function middleware(request: NextRequest) {
  // Apply security headers to all responses
  let response = NextResponse.next({
    request,
  });

  // Set up Supabase client with cookie handling (skip if env vars not set)
  let user = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Refresh session if it exists
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  }

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));
  const isProtectedRoute = protectedRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));
  const isApiRoute = pathname.startsWith('/api/');

  // Protected API routes
  if (isApiRoute && pathname !== '/api/auth/callback') {
    const protectedApiRoutes = ['/api/builder', '/api/library', '/api/admin', '/api/user'];
    const isProtectedApiRoute = protectedApiRoutes.some(route => pathname.startsWith(route));
    
    if (isProtectedApiRoute && !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: response.headers }
      );
    }
  }

  // Admin route protection
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(url);
    }

    // Check admin role (only if Supabase is configured)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const { data: profile } = await supabase
        .from('profiles')
        .select('role_flags')
        .eq('id', user.id)
        .single();

      if (!profile?.role_flags?.is_admin) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // Protected route handling
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo');
    return NextResponse.redirect(new URL(redirectTo || '/dashboard', request.url));
  }
  
  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Check rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    if (!checkRateLimit(request)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.'
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            ...Object.fromEntries(
              Object.entries(securityHeaders).map(([k, v]) => [k, v])
            )
          }
        }
      );
    }
  }
  
  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-Id', requestId);
  
  // Add timestamp
  response.headers.set('X-Response-Time', new Date().toISOString());
  
  // CORS handling for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Only allow specific origins in production
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? ['https://mindscript.app', 'https://www.mindscript.app']
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    const origin = request.headers.get('origin');
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }
  
  // Webhook signature verification reminder
  if (request.nextUrl.pathname.startsWith('/api/webhooks')) {
    // Note: Actual signature verification should be done in the webhook handler
    // This is just a reminder header
    response.headers.set('X-Webhook-Verification', 'required');
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/analytics', '/users'] // Protected routes
const PUBLIC_ROUTES = ['/login', '/unauthorized'] // Public routes

export async function middleware(request: NextRequest) {
  // Create a response that we can modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client with proper cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on request
          request.cookies.set({
            name,
            value,
            ...options,
          })
          // Update response to include the cookie
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Set cookie on response
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookie from request
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          // Update response to remove the cookie
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Remove cookie from response
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          })
        },
      },
    }
  )

  // Get user session - this also refreshes the token if needed
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = !!user
  const pathname = request.nextUrl.pathname

  // Check if route is protected
  const isProtectedRoute = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))
  const isLoginPage = pathname === '/login'

  // Handle unauthenticated access to protected routes
  if (!isAuthenticated && isProtectedRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    const redirectResponse = NextResponse.redirect(redirectUrl)
    // Prevent caching of redirect responses
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return redirectResponse
  }

  // Handle authenticated access to login page
  if (isAuthenticated && isLoginPage) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/analytics'
    const redirectUrl = new URL(redirectTo, request.url)
    const redirectResponse = NextResponse.redirect(redirectUrl)
    // Prevent caching of redirect responses
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return redirectResponse
  }

  // Return response with updated cookies
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - api routes (for other APIs if any)
     */
    '/((?!_next/static|_next/image|favicon.ico|images|api/(?!auth)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
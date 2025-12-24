import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/unauthorized'] // Routes that don't require auth
const DEFAULT_REDIRECT = '/analytics'

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
  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname === '/login'
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
  const isAuthApiRoute = pathname.startsWith('/api/auth')
  const requiresAuth = !isPublicRoute && !isAuthApiRoute

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = !!user

  const buildRedirectResponse = (url: string) => {
    const redirectUrl = new URL(url, request.url)
    const redirectResponse = NextResponse.redirect(redirectUrl)
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return redirectResponse
  }

  // Handle unauthenticated access to protected routes
  if (!isAuthenticated && requiresAuth) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    const redirectResponse = NextResponse.redirect(redirectUrl)
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return redirectResponse
  }

  // If not authenticated and route doesn't require auth, allow request to proceed
  if (!isAuthenticated) {
    return response
  }

  // Check admin role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Admin middleware profile lookup failed:', profileError)
  }

  const isActive = profile?.account_status ? profile.account_status === 'active' : true
  const hasAdminRole = profile ? ['admin', 'super_admin'].includes(profile.role) : false
  const isAdmin = !profileError && hasAdminRole && isActive

  if (!isAdmin && pathname !== '/unauthorized') {
    return buildRedirectResponse('/unauthorized')
  }

  if (isAdmin && (isAuthRoute || pathname === '/unauthorized')) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || DEFAULT_REDIRECT
    return buildRedirectResponse(redirectTo)
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

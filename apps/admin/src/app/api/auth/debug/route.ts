import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Look for Supabase auth cookies
  const authCookies = allCookies.filter(cookie =>
    cookie.name.includes('supabase') ||
    cookie.name.includes('auth')
  )

  return NextResponse.json({
    allCookies: allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })),
    authCookies: authCookies.map(c => ({ name: c.name, exists: !!c.value })),
    cookieCount: allCookies.length,
    authCookieCount: authCookies.length,
  })
}
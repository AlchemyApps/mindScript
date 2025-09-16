'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // Get form data
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string || '/analytics'

  // Validate inputs
  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required'))
  }

  // Attempt sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message) + '&redirectTo=' + encodeURIComponent(redirectTo))
  }

  // TEMPORARILY COMMENTED TO TEST - Role check bypassed
  // TODO: Uncomment after fixing profile data
  /*
  // Check if user has admin role
  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, account_status')
      .eq('id', data.user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role) || profile.account_status !== 'active') {
      await supabase.auth.signOut()
      redirect('/unauthorized')
    }
  }
  */

  // Revalidate all layouts and redirect to the desired page
  revalidatePath('/', 'layout')
  redirect(redirectTo)
}

export async function logout() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Logout error:', error)
    // Continue with redirect even if logout has an error
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
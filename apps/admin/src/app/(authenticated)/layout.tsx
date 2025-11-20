import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin-sidebar'
import { AdminHeader } from '@/components/admin-header'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware already handles authentication, we just need user data for UI
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile data for UI purposes (and double-check admin access)
  let profile = null
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, account_status, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      console.error('Failed to load admin profile in layout:', error)
    }
    const hasAdminRole = data ? ['admin', 'super_admin'].includes(data.role) : false
    const isActive = data?.account_status ? data.account_status === 'active' : true

    if (!hasAdminRole || !isActive) {
      const reason = !hasAdminRole ? 'not_admin' : 'inactive'
      redirect(`/unauthorized?reason=${reason}`)
    }
    profile = data
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={user} profile={profile} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <div className="container mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

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

  // User will always exist here thanks to middleware protection
  // Fetch profile data for UI purposes
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, account_status, full_name, avatar_url')
      .eq('id', user.id)
      .single()
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
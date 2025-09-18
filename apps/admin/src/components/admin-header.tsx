'use client'

import { Bell, LogOut, User } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { toast } from 'sonner'

interface AdminHeaderProps {
  user: any
  profile?: any
}

export function AdminHeader({ user, profile }: AdminHeaderProps) {
  const handleSignOut = async () => {
    try {
      await logout()
    } catch (error) {
      toast.error('Error signing out')
    }
  }

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm h-16 flex items-center justify-between px-6">
      <div className="flex-1">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
          Admin Dashboard
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex items-center space-x-2">
          <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {user?.email || profile?.email || 'Admin'}
          </span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <LogOut className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </form>
      </div>
    </header>
  )
}
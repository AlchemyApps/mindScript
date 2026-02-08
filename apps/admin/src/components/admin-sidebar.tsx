'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  ShoppingCart,
  Music,
  Settings,
  Activity,
  TrendingUp,
  Shield,
  DollarSign,
} from 'lucide-react'

const navigation = [
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'User Management', href: '/users', icon: Users },
  { name: 'Catalog', href: '/catalog', icon: Music },
  { name: 'Sellers', href: '/sellers', icon: ShoppingCart },
  { name: 'Pricing', href: '/pricing', icon: DollarSign },
  { name: 'Moderation', href: '/moderation', icon: Shield },
  { name: 'Activity Log', href: '/activity', icon: Activity },
  { name: 'Queue Monitor', href: '/monitoring/queue', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="bg-gray-800 text-white w-64 flex-shrink-0">
      <div className="flex items-center justify-center h-16 bg-gray-900">
        <span className="text-xl font-semibold">MindScript Admin</span>
      </div>
      <nav className="mt-5">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ${
                isActive ? 'bg-gray-700 text-white border-l-4 border-blue-500' : ''
              }`}
            >
              <Icon className="h-5 w-5 mr-3" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

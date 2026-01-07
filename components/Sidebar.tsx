'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Megaphone,
  Plus,
  Users,
  FileArrowUp,
  ClockCounterClockwise,
  SignOut,
} from '@phosphor-icons/react'

interface SidebarProps {
  onLogout: () => void
}

const navItems = [
  { href: '/campaigns', label: 'キャンペーン', icon: Megaphone },
  { href: '/campaigns/new', label: '新規作成', icon: Plus, indent: true },
  { href: '/contacts', label: '顧客管理', icon: Users },
  { href: '/contacts/import', label: 'インポート', icon: FileArrowUp, indent: true },
  { href: '/logs', label: '送信ログ', icon: ClockCounterClockwise },
]

export default function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-56 h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo/Title */}
      <div className="h-14 px-4 flex items-center border-b border-gray-150">
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
          SMS一括送信
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isIndented = 'indent' in item && item.indent
          const isActive = pathname === item.href ||
            (!isIndented && item.href !== '/campaigns' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2.5 py-2 rounded text-sm font-medium
                transition-all duration-150 ease-smooth
                ${isIndented ? 'pl-7 pr-2.5' : 'px-2.5'}
                ${isActive
                  ? 'bg-accent-50 text-accent-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-accent-500' : ''} ${isIndented ? 'w-3.5 h-3.5' : ''}`}
                weight={isActive ? 'fill' : 'regular'}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-gray-150">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150"
        >
          <SignOut className="w-4 h-4" />
          ログアウト
        </button>
      </div>
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  FileText,
  Inbox,
  Receipt,
  Wallet,
  MessageSquare,
  Landmark,
  Shield,
  CreditCard,
  Zap,
  Car,
  HeartPulse,
  Wrench,
  ShoppingCart,
  CalendarCheck,
  Wifi,
  Smartphone,
  BatteryCharging,
  Droplets,
  Users,
  Scale,
  TrendingUp,
  PiggyBank,
  ShieldCheck,
} from 'lucide-react'

interface NavSection {
  title?: string
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
}

const navSections: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/documents', label: 'Documents', icon: FileText },
      { href: '/inbox', label: 'Inbox', icon: Inbox },
      { href: '/receipts', label: 'Receipts', icon: Receipt },
      { href: '/budget', label: 'Budget', icon: Wallet },
      { href: '/banking', label: 'Banking', icon: Landmark },
      { href: '/insurance', label: 'Insurance', icon: Shield },
      { href: '/credit-cards', label: 'Credit Cards', icon: CreditCard },
      { href: '/utilities', label: 'Utilities', icon: Zap },
      { href: '/vehicles', label: 'Vehicles', icon: Car },
      { href: '/medical', label: 'Medical Aid', icon: HeartPulse },
      { href: '/maintenance', label: 'Maintenance', icon: Wrench },
      { href: '/chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    title: 'Lifestyle & Advanced',
    items: [
      { href: '/grocery', label: 'Grocery', icon: ShoppingCart },
      { href: '/bookings', label: 'Bookings', icon: CalendarCheck },
      { href: '/isp', label: 'ISP', icon: Wifi },
      { href: '/devices', label: 'Devices', icon: Smartphone },
      { href: '/energy', label: 'Energy', icon: BatteryCharging },
      { href: '/water', label: 'Water', icon: Droplets },
      { href: '/staff', label: 'Staff', icon: Users },
      { href: '/legal', label: 'Legal', icon: Scale },
      { href: '/shopping', label: 'Shopping', icon: TrendingUp },
      { href: '/financial-planning', label: 'Financial Planning', icon: PiggyBank },
      { href: '/security', label: 'Security', icon: ShieldCheck },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-600">HouseholdOS</h1>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}

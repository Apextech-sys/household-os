'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { User, Shield, Calendar } from 'lucide-react'
import { clsx } from 'clsx'

interface Employee {
  id: string
  full_name: string
  role: string
  status: string
  uif_registered: boolean
  leave_days_annual: number
  leave_days_used: number
  start_date: string | null
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'error',
}

const ROLE_LABELS: Record<string, string> = {
  domestic_worker: 'Domestic Worker',
  gardener: 'Gardener',
  nanny: 'Nanny',
  driver: 'Driver',
  other: 'Other',
}

export function EmployeeCard({ employee }: { employee: Employee }) {
  const leaveRemaining = employee.leave_days_annual - employee.leave_days_used
  const leavePercent = employee.leave_days_annual > 0
    ? Math.round((employee.leave_days_used / employee.leave_days_annual) * 100)
    : 0

  return (
    <Link href={`/staff/${employee.id}`} className="block group">
      <Card className="hover:border-blue-300 transition-colors h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
              <CardTitle className="text-base leading-tight">
                {employee.full_name}
              </CardTitle>
            </div>
            <Badge variant={STATUS_VARIANT[employee.status] ?? 'secondary'} className="capitalize shrink-0">
              {employee.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {ROLE_LABELS[employee.role] ?? employee.role}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* UIF Status */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <Shield className="h-3.5 w-3.5" />
              UIF Registered
            </span>
            <Badge variant={employee.uif_registered ? 'success' : 'warning'}>
              {employee.uif_registered ? 'Yes' : 'No'}
            </Badge>
          </div>

          {/* Leave Balance */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="h-3.5 w-3.5" />
              Leave Balance
            </span>
            <span className={clsx(
              'text-xs font-medium',
              leaveRemaining <= 3 ? 'text-red-600' : 'text-gray-700'
            )}>
              {leaveRemaining} / {employee.leave_days_annual} days
            </span>
          </div>

          {/* Leave progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={clsx(
                'h-2 rounded-full transition-all',
                leavePercent >= 90 ? 'bg-red-500' :
                leavePercent >= 70 ? 'bg-yellow-500' :
                'bg-blue-500'
              )}
              style={{ width: `${Math.min(leavePercent, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

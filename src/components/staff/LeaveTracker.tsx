'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Calendar } from 'lucide-react'
import { clsx } from 'clsx'

interface Employee {
  id: string
  full_name: string
  role: string
  leave_days_annual: number
  leave_days_used: number
}

const ROLE_LABELS: Record<string, string> = {
  domestic_worker: 'Domestic Worker',
  gardener: 'Gardener',
  nanny: 'Nanny',
  driver: 'Driver',
  other: 'Other',
}

export function LeaveTracker({ employees }: { employees: Employee[] }) {
  if (employees.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          Leave Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {employees.map(emp => {
            const remaining = emp.leave_days_annual - emp.leave_days_used
            const percent = emp.leave_days_annual > 0
              ? Math.round((emp.leave_days_used / emp.leave_days_annual) * 100)
              : 0

            return (
              <div key={emp.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{emp.full_name}</span>
                    <span className="text-gray-400 ml-2 text-xs">
                      {ROLE_LABELS[emp.role] ?? emp.role}
                    </span>
                  </div>
                  <span className={clsx(
                    'text-xs font-medium',
                    remaining <= 3 ? 'text-red-600' : 'text-gray-600'
                  )}>
                    {remaining} of {emp.leave_days_annual} remaining
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={clsx(
                      'h-2.5 rounded-full transition-all',
                      percent >= 90 ? 'bg-red-500' :
                      percent >= 70 ? 'bg-yellow-500' :
                      'bg-blue-500'
                    )}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

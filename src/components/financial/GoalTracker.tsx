'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Target, Calendar } from 'lucide-react'
import { clsx } from 'clsx'

interface FinancialGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  currency: string
  deadline: string | null
  category: string
  status: string
  created_at: string
  updated_at: string
}

const categoryLabels: Record<string, string> = {
  emergency_fund: 'Emergency Fund',
  retirement: 'Retirement',
  education: 'Education',
  property: 'Property',
  holiday: 'Holiday',
  vehicle: 'Vehicle',
  other: 'Other',
}

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'secondary' | 'default'> = {
  active: 'default',
  achieved: 'success',
  paused: 'warning',
  cancelled: 'error',
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function GoalTracker({ goals }: { goals: FinancialGoal[] }) {
  if (goals.length === 0) {
    return <p className="text-gray-500 text-sm">No financial goals found.</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {goals.map((goal) => {
        const progress = goal.target_amount > 0
          ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
          : 0
        const deadlineDays = goal.deadline ? daysUntil(goal.deadline) : null

        return (
          <Card key={goal.id} className="h-full">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-gray-400 shrink-0" />
                  <CardTitle className="text-base leading-tight">{goal.name}</CardTitle>
                </div>
                <Badge variant={statusVariant[goal.status] ?? 'secondary'} className="capitalize shrink-0">
                  {goal.status}
                </Badge>
              </div>
              <Badge variant="secondary" className="mt-2 w-fit">
                {categoryLabels[goal.category] ?? goal.category}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    {formatCurrency(goal.current_amount, goal.currency)}
                  </span>
                  <span className="text-gray-500">
                    {formatCurrency(goal.target_amount, goal.currency)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-blue-400'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">{progress.toFixed(1)}%</p>
              </div>

              {/* Deadline */}
              {goal.deadline && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Calendar className="h-3.5 w-3.5" />
                    Deadline
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={clsx('text-xs', deadlineDays !== null && deadlineDays <= 0 ? 'text-red-600' : 'text-gray-500')}>
                      {new Date(goal.deadline).toLocaleDateString('en-ZA', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                    {deadlineDays !== null && (
                      <Badge variant={deadlineDays < 0 ? 'error' : deadlineDays <= 30 ? 'warning' : 'secondary'}>
                        {deadlineDays < 0
                          ? `${Math.abs(deadlineDays)}d overdue`
                          : deadlineDays === 0
                          ? 'Today'
                          : `${deadlineDays}d left`}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

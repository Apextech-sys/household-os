'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AlertCircle, Receipt } from 'lucide-react'
import { clsx } from 'clsx'

interface FineEvent {
  id: string
  event_type: string
  description: string | null
  amount: number | null
  event_date: string
  next_due_date: string | null
  provider: string | null
}

function formatZAR(amount: number | null) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

function fineStatus(fine: FineEvent): { label: string; variant: 'error' | 'warning' | 'success' | 'secondary' } {
  if (!fine.next_due_date) return { label: 'Unknown', variant: 'secondary' }
  const days = Math.ceil((new Date(fine.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { label: 'Overdue', variant: 'error' }
  if (days <= 7) return { label: `Due in ${days}d`, variant: 'warning' }
  return { label: `Due in ${days}d`, variant: 'default' as 'secondary' }
}

export function FineManager({ fines }: { fines: FineEvent[] }) {
  const totalOutstanding = fines.reduce((sum, f) => sum + (f.amount ?? 0), 0)
  const overdueCount = fines.filter(f => {
    if (!f.next_due_date) return false
    return new Date(f.next_due_date) < new Date()
  }).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-red-500" />
            Traffic Fines
          </CardTitle>
          {fines.length > 0 && (
            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <Badge variant="error">
                  {overdueCount} overdue
                </Badge>
              )}
              <span className="text-sm font-semibold text-gray-900">
                Total: {formatZAR(totalOutstanding)}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {fines.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <AlertCircle className="h-4 w-4 text-green-500" />
            No outstanding fines.
          </div>
        ) : (
          <div className="space-y-3">
            {fines.map(fine => {
              const status = fineStatus(fine)
              return (
                <div
                  key={fine.id}
                  className={clsx(
                    'flex items-start justify-between p-4 rounded-lg border',
                    status.variant === 'error'
                      ? 'border-red-100 bg-red-50'
                      : status.variant === 'warning'
                      ? 'border-yellow-100 bg-yellow-50'
                      : 'border-gray-100 bg-gray-50'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {fine.description && (
                        <span className="font-medium text-gray-900 text-sm">{fine.description}</span>
                      )}
                      <Badge variant={status.variant as 'error' | 'warning' | 'success' | 'secondary' | 'default'}>
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      Issued: {new Date(fine.event_date).toLocaleDateString('en-ZA', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {fine.provider && ` — ${fine.provider}`}
                    </p>
                    {fine.next_due_date && (
                      <p className={clsx(
                        'text-xs mt-0.5',
                        status.variant === 'error' ? 'text-red-600' : 'text-gray-400'
                      )}>
                        Payment due: {new Date(fine.next_due_date).toLocaleDateString('en-ZA', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className={clsx(
                      'text-sm font-semibold',
                      status.variant === 'error' ? 'text-red-700' : 'text-gray-900'
                    )}>
                      {formatZAR(fine.amount)}
                    </p>
                  </div>
                </div>
              )
            })}

            {/* Total summary row */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Total Outstanding</span>
              <span className="text-base font-bold text-gray-900">{formatZAR(totalOutstanding)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

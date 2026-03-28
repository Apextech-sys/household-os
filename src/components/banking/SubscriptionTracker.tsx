'use client'

import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { RefreshCw, XCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface Subscription {
  id: string
  name: string
  provider: string | null
  amount: number
  frequency: string
  first_seen: string | null
  last_seen: string | null
  category: string | null
  is_active: boolean
}

const frequencyLabel: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

function formatZAR(amount: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

export function SubscriptionTracker({ subscriptions }: { subscriptions: Subscription[] }) {
  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <RefreshCw className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No subscriptions detected</p>
        <p className="text-sm mt-1">Recurring subscriptions will be detected from your transaction history.</p>
      </div>
    )
  }

  const active = subscriptions.filter((s) => s.is_active)
  const inactive = subscriptions.filter((s) => !s.is_active)

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Active ({active.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} />
            ))}
          </div>
        </div>
      )}
      {inactive.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Inactive ({inactive.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inactive.map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SubscriptionCard({ subscription: sub }: { subscription: Subscription }) {
  return (
    <Card className={clsx(!sub.is_active && 'opacity-60')}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {!sub.is_active && <XCircle className="h-4 w-4 text-gray-400 shrink-0" />}
              <span className={clsx('font-medium truncate', !sub.is_active && 'line-through text-gray-400')}>
                {sub.name}
              </span>
            </div>
            {sub.provider && (
              <p className="text-xs text-gray-500 mt-0.5">{sub.provider}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-gray-900">{formatZAR(Number(sub.amount))}</p>
            <p className="text-xs text-gray-500">{frequencyLabel[sub.frequency] ?? sub.frequency}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {sub.is_active ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
          {sub.category && (
            <Badge variant="default">{sub.category}</Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          {sub.first_seen && (
            <span>Since {new Date(sub.first_seen).toLocaleDateString()}</span>
          )}
          {sub.last_seen && (
            <span>Last seen {new Date(sub.last_seen).toLocaleDateString()}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

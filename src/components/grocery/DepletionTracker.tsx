'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Clock, PackageCheck } from 'lucide-react'
import { clsx } from 'clsx'

interface GroceryItem {
  id: string
  name: string
  category: string | null
  last_purchased: string | null
  avg_purchase_interval_days: number | null
  predicted_next_purchase: string | null
  unit_price: number | null
  preferred_retailer: string | null
  created_at: string
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function DepletionTracker({ items }: { items: GroceryItem[] }) {
  const sorted = [...items].sort((a, b) => {
    if (!a.predicted_next_purchase) return 1
    if (!b.predicted_next_purchase) return -1
    return new Date(a.predicted_next_purchase).getTime() - new Date(b.predicted_next_purchase).getTime()
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
        <PackageCheck className="h-5 w-5" />
        Depletion Tracker
      </h2>

      {sorted.length === 0 ? (
        <p className="text-gray-500 text-sm">No tracked items yet.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100">
              {sorted.map((item) => {
                const days = item.predicted_next_purchase
                  ? daysUntil(item.predicted_next_purchase)
                  : null

                return (
                  <li key={item.id} className="flex items-center justify-between px-6 py-3 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className="text-gray-500 text-xs">
                        {item.category && `${item.category} · `}
                        {item.preferred_retailer && `${item.preferred_retailer}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.unit_price != null && (
                        <span className="text-gray-500 text-xs">
                          R{item.unit_price.toFixed(2)}
                        </span>
                      )}
                      {days != null ? (
                        <Badge
                          variant={
                            days <= 0 ? 'error' : days <= 3 ? 'warning' : 'default'
                          }
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {days <= 0
                            ? `Overdue by ${Math.abs(days)}d`
                            : `${days}d remaining`}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No prediction</Badge>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

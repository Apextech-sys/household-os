'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ShoppingCart, TrendingDown, TrendingUp, Bell, BellOff } from 'lucide-react'
import { clsx } from 'clsx'

interface PriceWatch {
  id: string
  product_name: string
  retailer: string | null
  current_price: number | null
  lowest_price: number | null
  highest_price: number | null
  currency: string
  target_price: number | null
  alert_enabled: boolean
  status: string
  price_history: Array<{ date: string; price: number }>
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'secondary'> = {
  watching: 'default',
  target_reached: 'success',
  paused: 'secondary',
}

function formatCurrency(amount: number | null, currency: string) {
  if (amount == null) return '--'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
}

export function PriceWatchList({ watches: initialWatches }: { watches: PriceWatch[] }) {
  const [watches, setWatches] = useState(initialWatches)

  async function toggleAlert(id: string, currentEnabled: boolean) {
    const res = await fetch('/api/shopping/watches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, alert_enabled: !currentEnabled }),
    })

    if (res.ok) {
      setWatches(prev =>
        prev.map(w => w.id === id ? { ...w, alert_enabled: !currentEnabled } : w)
      )
    }
  }

  if (watches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-gray-500 text-center">No price watches yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {watches.map(watch => (
        <Card key={watch.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="h-4 w-4 text-gray-400 shrink-0" />
                  <h3 className="font-medium text-gray-900 truncate">{watch.product_name}</h3>
                  <Badge variant={STATUS_VARIANT[watch.status] ?? 'secondary'} className="capitalize shrink-0">
                    {watch.status.replace('_', ' ')}
                  </Badge>
                </div>
                {watch.retailer && (
                  <p className="text-xs text-gray-500 ml-6">{watch.retailer}</p>
                )}
              </div>

              {/* Alert toggle */}
              <button
                onClick={() => toggleAlert(watch.id, watch.alert_enabled)}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  watch.alert_enabled ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'
                )}
                title={watch.alert_enabled ? 'Disable alerts' : 'Enable alerts'}
              >
                {watch.alert_enabled ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Price details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 ml-6">
              <div>
                <p className="text-xs text-gray-500">Current</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(watch.current_price, watch.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-green-500" /> Lowest
                </p>
                <p className="text-sm font-medium text-green-700">
                  {formatCurrency(watch.lowest_price, watch.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-red-500" /> Highest
                </p>
                <p className="text-sm font-medium text-red-700">
                  {formatCurrency(watch.highest_price, watch.currency)}
                </p>
              </div>
              {watch.target_price != null && (
                <div>
                  <p className="text-xs text-gray-500">Target</p>
                  <p className={clsx(
                    'text-sm font-medium',
                    watch.current_price != null && watch.current_price <= watch.target_price
                      ? 'text-green-700'
                      : 'text-gray-700'
                  )}>
                    {formatCurrency(watch.target_price, watch.currency)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

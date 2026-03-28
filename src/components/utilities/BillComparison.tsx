'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { clsx } from 'clsx'

interface Bill {
  id: string
  bill_date: string
  total_amount: number | string
  is_anomalous: boolean
  due_date: string
}

interface BillComparisonProps {
  bills: Bill[]
}

export function BillComparison({ bills }: BillComparisonProps) {
  // Show most recent bills first, up to 12
  const sorted = [...bills]
    .sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime())
    .slice(0, 12)
    .reverse() // chronological for the chart

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bill Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No bills to compare.</p>
        </CardContent>
      </Card>
    )
  }

  const maxAmount = Math.max(...sorted.map(b => Number(b.total_amount)))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bill Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map((bill, index) => {
            const amount = Number(bill.total_amount)
            const widthPct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
            const prevBill = index > 0 ? sorted[index - 1] : null
            const prevAmount = prevBill ? Number(prevBill.total_amount) : null
            const pctChange = prevAmount && prevAmount > 0
              ? ((amount - prevAmount) / prevAmount) * 100
              : null

            return (
              <div key={bill.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {new Date(bill.bill_date).toLocaleDateString('en-ZA', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    {pctChange !== null && (
                      <span className={clsx(
                        'text-xs font-medium',
                        pctChange > 20 ? 'text-red-600' : pctChange > 0 ? 'text-yellow-600' : 'text-green-600'
                      )}>
                        {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                      </span>
                    )}
                    <span className={clsx(
                      'font-semibold',
                      bill.is_anomalous ? 'text-red-600' : 'text-gray-900'
                    )}>
                      R {amount.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded transition-all duration-300',
                      bill.is_anomalous ? 'bg-red-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                {bill.is_anomalous && (
                  <p className="text-xs text-red-600 font-medium">Anomalous bill detected</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Anomalous</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

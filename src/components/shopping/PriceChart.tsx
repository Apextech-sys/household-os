'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { TrendingUp } from 'lucide-react'

interface PriceEntry {
  date: string
  price: number
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function PriceChart({ productName, priceHistory, currency = 'ZAR' }: {
  productName: string
  priceHistory: PriceEntry[]
  currency?: string
}) {
  if (!priceHistory || priceHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Price History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No price history available for {productName}.</p>
        </CardContent>
      </Card>
    )
  }

  const sorted = [...priceHistory].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          Price History — {productName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, idx) => {
                const prevPrice = idx < sorted.length - 1 ? sorted[idx + 1].price : null
                const diff = prevPrice !== null ? entry.price - prevPrice : null

                return (
                  <tr key={entry.date} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-3 text-gray-700">{formatDate(entry.date)}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">
                      {formatCurrency(entry.price, currency)}
                      {diff !== null && diff !== 0 && (
                        <span className={`ml-2 text-xs ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff, currency)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

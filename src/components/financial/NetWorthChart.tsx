'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'

interface NetWorthSnapshot {
  id: string
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  breakdown: Record<string, unknown> | null
  created_at: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

export function NetWorthChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length === 0) {
    return <p className="text-gray-500 text-sm">No net worth snapshots found.</p>
  }

  // Show in chronological order (oldest first)
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          <CardTitle className="text-base">Net Worth Over Time</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Date</th>
                <th className="text-right py-2 px-4 font-medium text-gray-600">Assets</th>
                <th className="text-right py-2 px-4 font-medium text-gray-600">Liabilities</th>
                <th className="text-right py-2 pl-4 font-medium text-gray-600">Net Worth</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((snapshot) => (
                <tr key={snapshot.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 text-gray-700">
                    {new Date(snapshot.snapshot_date).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="py-2 px-4 text-right text-green-700">
                    {formatCurrency(snapshot.total_assets)}
                  </td>
                  <td className="py-2 px-4 text-right text-red-600">
                    {formatCurrency(snapshot.total_liabilities)}
                  </td>
                  <td className={clsx(
                    'py-2 pl-4 text-right font-medium',
                    snapshot.net_worth >= 0 ? 'text-green-700' : 'text-red-600'
                  )}>
                    {formatCurrency(snapshot.net_worth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

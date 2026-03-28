'use client'

import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { AlertTriangle, ArrowDownUp } from 'lucide-react'
import { clsx } from 'clsx'

interface DebitOrder {
  id: string
  description: string
  amount: number
  frequency: string
  expected_day: number | null
  last_seen_date: string | null
  is_anomalous: boolean
  anomaly_reason: string | null
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

export function DebitOrderList({ debitOrders }: { debitOrders: DebitOrder[] }) {
  if (debitOrders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ArrowDownUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No debit orders found</p>
        <p className="text-sm mt-1">Debit orders will appear here once detected from your transactions.</p>
      </div>
    )
  }

  const anomalousCount = debitOrders.filter((d) => d.is_anomalous).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Debit Orders ({debitOrders.length})</CardTitle>
          {anomalousCount > 0 && (
            <Badge variant="error">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {anomalousCount} anomal{anomalousCount === 1 ? 'y' : 'ies'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Amount</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Frequency</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Expected Day</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Last Seen</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {debitOrders.map((order) => (
                <tr
                  key={order.id}
                  className={clsx(
                    'border-b border-gray-50 last:border-0',
                    order.is_anomalous ? 'bg-red-50' : 'hover:bg-gray-50'
                  )}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {order.is_anomalous && (
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={clsx('font-medium', order.is_anomalous && 'text-red-700')}>
                        {order.description}
                      </span>
                    </div>
                    {order.is_anomalous && order.anomaly_reason && (
                      <p className="text-xs text-red-600 mt-0.5 ml-6">{order.anomaly_reason}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium whitespace-nowrap">
                    {formatZAR(Number(order.amount))}
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="secondary">
                      {frequencyLabel[order.frequency] ?? order.frequency}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-gray-600">
                    {order.expected_day != null ? `Day ${order.expected_day}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-gray-600">
                    {order.last_seen_date
                      ? new Date(order.last_seen_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="py-3 px-3">
                    {order.is_anomalous ? (
                      <Badge variant="error">Anomalous</Badge>
                    ) : (
                      <Badge variant="success">Normal</Badge>
                    )}
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

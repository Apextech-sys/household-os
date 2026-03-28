'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

interface WaterReading {
  id: string
  reading_date: string
  kl_consumed: number
  cost_zar: number | null
}

export function UsageChart({ readings }: { readings: WaterReading[] }) {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime()
  )

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Water Usage History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No water readings recorded yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Water Usage History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Date</th>
                <th className="text-right py-2 px-4 font-medium text-gray-600">kL Consumed</th>
                <th className="text-right py-2 pl-4 font-medium text-gray-600">Cost (ZAR)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(reading => (
                <tr key={reading.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-700">
                    {new Date(reading.reading_date).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-900 font-medium">
                    {reading.kl_consumed.toLocaleString('en-ZA', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="py-2 pl-4 text-right text-gray-700">
                    {reading.cost_zar != null
                      ? `R ${reading.cost_zar.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                      : '-'}
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

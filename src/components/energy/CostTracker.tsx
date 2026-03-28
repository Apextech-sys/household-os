'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface EnergyReading {
  id: string
  reading_date: string
  kwh_consumed: number
  cost_zar: number | null
  tariff_type: string | null
}

export function CostTracker({ readings }: { readings: EnergyReading[] }) {
  const withCost = readings.filter(r => r.cost_zar != null)
  const totalCost = withCost.reduce((sum, r) => sum + (r.cost_zar ?? 0), 0)

  // Calculate average daily cost
  let avgDailyCost = 0
  if (withCost.length >= 2) {
    const sorted = [...withCost].sort(
      (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime()
    )
    const firstDate = new Date(sorted[0].reading_date).getTime()
    const lastDate = new Date(sorted[sorted.length - 1].reading_date).getTime()
    const days = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)))
    avgDailyCost = totalCost / days
  } else if (withCost.length === 1) {
    avgDailyCost = withCost[0].cost_zar ?? 0
  }

  // Tariff breakdown
  const tariffGroups = withCost.reduce<Record<string, { count: number; totalCost: number; totalKwh: number }>>((acc, r) => {
    const tariff = r.tariff_type ?? 'unspecified'
    if (!acc[tariff]) acc[tariff] = { count: 0, totalCost: 0, totalKwh: 0 }
    acc[tariff].count++
    acc[tariff].totalCost += r.cost_zar ?? 0
    acc[tariff].totalKwh += r.kwh_consumed
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Cumulative Cost</p>
            <p className="text-2xl font-bold text-gray-900">
              R {totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              From {withCost.length} reading{withCost.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Average Daily Cost</p>
            <p className="text-2xl font-bold text-gray-900">
              R {avgDailyCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">per day</p>
          </div>
        </div>

        {/* Tariff breakdown */}
        {Object.keys(tariffGroups).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">Tariff Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(tariffGroups).map(([tariff, data]) => (
                <div key={tariff} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{tariff}</Badge>
                    <span className="text-gray-500">{data.count} readings</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      R {data.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {data.totalKwh.toLocaleString('en-ZA', { minimumFractionDigits: 1 })} kWh
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {withCost.length === 0 && (
          <p className="text-gray-500 text-sm">No cost data recorded yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

interface EnergyReading {
  id: string
  reading_date: string
  kwh_consumed: number
  kwh_solar_generated: number | null
  cost_zar: number | null
}

export function ConsumptionChart({ readings }: { readings: EnergyReading[] }) {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime()
  )

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consumption History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No energy readings recorded yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumption History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Date</th>
                <th className="text-right py-2 px-4 font-medium text-gray-600">kWh Consumed</th>
                <th className="text-right py-2 px-4 font-medium text-gray-600">kWh Solar</th>
                <th className="text-right py-2 pl-4 font-medium text-gray-600">Net kWh</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(reading => {
                const net = reading.kwh_consumed - (reading.kwh_solar_generated ?? 0)
                return (
                  <tr key={reading.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-700">
                      {new Date(reading.reading_date).toLocaleDateString('en-ZA', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-900 font-medium">
                      {reading.kwh_consumed.toLocaleString('en-ZA', { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-2 px-4 text-right text-green-600">
                      {reading.kwh_solar_generated != null
                        ? reading.kwh_solar_generated.toLocaleString('en-ZA', { minimumFractionDigits: 1 })
                        : '-'}
                    </td>
                    <td className="py-2 pl-4 text-right font-medium text-gray-900">
                      {net.toLocaleString('en-ZA', { minimumFractionDigits: 1 })}
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

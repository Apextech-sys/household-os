'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AlertTriangle } from 'lucide-react'

interface WaterReading {
  id: string
  reading_date: string
  overnight_flow_detected: boolean
  overnight_flow_litres: number | null
}

export function LeakAlert({ readings }: { readings: WaterReading[] }) {
  const leakReadings = readings
    .filter(r => r.overnight_flow_detected)
    .sort((a, b) => new Date(b.reading_date).getTime() - new Date(a.reading_date).getTime())

  if (leakReadings.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <CardTitle>Leak Alerts</CardTitle>
          <Badge variant="error">{leakReadings.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-gray-100">
          {leakReadings.map(reading => (
            <li key={reading.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-sm text-gray-700">
                  {new Date(reading.reading_date).toLocaleDateString('en-ZA', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              </div>
              <div className="text-sm">
                {reading.overnight_flow_litres != null ? (
                  <span className="font-medium text-red-600">
                    {reading.overnight_flow_litres.toLocaleString('en-ZA', { minimumFractionDigits: 1 })} litres
                  </span>
                ) : (
                  <Badge variant="warning">Flow detected</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

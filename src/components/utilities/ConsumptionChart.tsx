'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { clsx } from 'clsx'

interface ConsumptionEntry {
  [key: string]: number | string | undefined
  units?: string
}

interface Bill {
  id: string
  bill_date: string
  consumption: ConsumptionEntry | null
}

interface ConsumptionChartProps {
  bills: Bill[]
}

function extractConsumptionValue(consumption: ConsumptionEntry | null): { value: number; unit: string } | null {
  if (!consumption) return null

  // Common field names for consumption quantity
  const valueKeys = ['quantity', 'amount', 'usage', 'value', 'kWh', 'kl', 'litres', 'units_used', 'consumption']
  const unitKeys = ['unit', 'units', 'uom', 'measure']

  let value: number | null = null
  let unit = ''

  // Try to find numeric value
  for (const key of valueKeys) {
    const v = consumption[key]
    if (typeof v === 'number') {
      value = v
      break
    }
    if (typeof v === 'string' && !isNaN(parseFloat(v))) {
      value = parseFloat(v)
      break
    }
  }

  // If no known key, try first numeric value in the object
  if (value === null) {
    for (const [, v] of Object.entries(consumption)) {
      if (typeof v === 'number') {
        value = v
        break
      }
      if (typeof v === 'string' && !isNaN(parseFloat(v)) && parseFloat(v) > 0) {
        value = parseFloat(v)
        break
      }
    }
  }

  // Extract unit label
  for (const key of unitKeys) {
    const u = consumption[key]
    if (typeof u === 'string') {
      unit = u
      break
    }
  }

  if (consumption.units && typeof consumption.units === 'string') {
    unit = consumption.units
  }

  if (value === null) return null
  return { value, unit }
}

export function ConsumptionChart({ bills }: ConsumptionChartProps) {
  const sorted = [...bills]
    .filter(b => b.consumption !== null)
    .sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime())
    .slice(-12)

  const entries = sorted.map(bill => ({
    bill,
    parsed: extractConsumptionValue(bill.consumption),
  })).filter(e => e.parsed !== null) as Array<{
    bill: Bill
    parsed: { value: number; unit: string }
  }>

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consumption Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No consumption data available.</p>
        </CardContent>
      </Card>
    )
  }

  const maxValue = Math.max(...entries.map(e => e.parsed.value))
  const unitLabel = entries[0]?.parsed.unit || 'units'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumption Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-4">Unit: {unitLabel}</p>
        <div className="space-y-3">
          {entries.map(({ bill, parsed }) => {
            const widthPct = maxValue > 0 ? (parsed.value / maxValue) * 100 : 0
            const avgValue = entries.reduce((sum, e) => sum + e.parsed.value, 0) / entries.length
            const isHigh = parsed.value > avgValue * 1.25

            return (
              <div key={bill.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 shrink-0 text-right">
                  {new Date(bill.bill_date).toLocaleDateString('en-ZA', {
                    month: 'short',
                    year: '2-digit',
                  })}
                </span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded transition-all duration-300',
                      isHigh ? 'bg-orange-400' : 'bg-teal-500'
                    )}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className={clsx(
                  'text-xs font-medium w-20 shrink-0',
                  isHigh ? 'text-orange-600' : 'text-gray-700'
                )}>
                  {parsed.value.toFixed(1)} {unitLabel}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-teal-500" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-400" />
            <span>Above average (&gt;25%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

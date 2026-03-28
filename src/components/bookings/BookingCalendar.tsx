'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CalendarDays } from 'lucide-react'

interface Booking {
  id: string
  title: string
  booking_type: string
  provider: string | null
  booking_date: string
  booking_time: string | null
  end_time: string | null
  status: string
  reference_number: string | null
  notes: string | null
  cost: number | null
  currency: string
  hitl_action_id: string | null
  created_at: string
}

const STATUS_VARIANT: Record<string, string> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'error',
  completed: 'secondary',
}

export function BookingCalendar({ bookings }: { bookings: Booking[] }) {
  // Group by month
  const grouped = bookings.reduce<Record<string, Booking[]>>((acc, b) => {
    const date = new Date(b.booking_date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  const sortedMonths = Object.keys(grouped).sort()

  function formatMonth(key: string): string {
    const [year, month] = key.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
        <CalendarDays className="h-5 w-5" />
        Booking Calendar
      </h2>

      {sortedMonths.length === 0 ? (
        <p className="text-gray-500 text-sm">No bookings yet.</p>
      ) : (
        sortedMonths.map((month) => (
          <Card key={month}>
            <CardHeader>
              <CardTitle className="text-base">{formatMonth(month)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {grouped[month].map((b) => (
                  <li key={b.id} className="flex items-center justify-between px-6 py-3 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{b.title}</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(b.booking_date).toLocaleDateString('en-ZA')}
                        {b.booking_time && ` at ${b.booking_time}`}
                        {b.provider && ` · ${b.provider}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{b.booking_type}</Badge>
                      <Badge variant={(STATUS_VARIANT[b.status] ?? 'default') as 'default' | 'success' | 'warning' | 'error' | 'secondary'}>
                        {b.status}
                      </Badge>
                      {b.cost != null && (
                        <span className="text-gray-500 text-xs">
                          {b.currency} {b.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

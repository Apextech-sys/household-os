'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Wrench, CalendarClock } from 'lucide-react'

interface VehicleEvent {
  id: string
  event_type: string
  description: string | null
  amount: number | null
  event_date: string
  next_due_date: string | null
  provider: string | null
}

function formatZAR(amount: number | null) {
  if (amount == null) return null
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function ServiceTimeline({ events }: { events: VehicleEvent[] }) {
  const serviceEvents = events.filter(e => e.event_type === 'service')

  // Find next due dates from service events
  const upcomingDue = serviceEvents
    .filter(e => e.next_due_date)
    .sort((a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime())
    .slice(0, 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-blue-500" />
          Service History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Next due alert */}
        {upcomingDue.length > 0 && (() => {
          const next = upcomingDue[0]
          const days = daysUntil(next.next_due_date!)
          const variant = days < 0 ? 'error' : days <= 14 ? 'warning' : 'default'
          return (
            <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <CalendarClock className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">Next service due</p>
                <p className="text-xs text-blue-700">
                  {new Date(next.next_due_date!).toLocaleDateString('en-ZA', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {next.provider && ` — ${next.provider}`}
                </p>
              </div>
              <Badge variant={variant}>
                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
              </Badge>
            </div>
          )
        })()}

        {serviceEvents.length === 0 ? (
          <p className="text-gray-500 text-sm">No service records found.</p>
        ) : (
          <ol className="relative border-l border-gray-200 space-y-0">
            {serviceEvents.map((event, index) => (
              <li key={event.id} className={`ml-4 ${index < serviceEvents.length - 1 ? 'pb-6' : ''}`}>
                <div className="absolute w-3 h-3 bg-blue-200 rounded-full -left-1.5 border border-white mt-1.5" />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <time className="text-xs font-normal text-gray-400">
                      {new Date(event.event_date).toLocaleDateString('en-ZA', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </time>
                    {event.description && (
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{event.description}</p>
                    )}
                    {event.provider && (
                      <p className="text-xs text-gray-500 mt-0.5">{event.provider}</p>
                    )}
                    {event.next_due_date && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Next due: {new Date(event.next_due_date).toLocaleDateString('en-ZA', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  {event.amount != null && (
                    <span className="text-sm font-medium text-gray-900 shrink-0">
                      {formatZAR(event.amount)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

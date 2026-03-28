'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { AlertTriangle, PlusCircle } from 'lucide-react'

const BOOKING_TYPES = ['restaurant', 'travel', 'service', 'event', 'other'] as const
const EXTERNAL_TYPES = ['restaurant', 'travel', 'service']

export function BookingForm({ onCreated }: { onCreated?: () => void }) {
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [bookingType, setBookingType] = useState<string>('restaurant')
  const [provider, setProvider] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [notes, setNotes] = useState('')
  const [cost, setCost] = useState('')
  const [success, setSuccess] = useState(false)

  const isExternal = EXTERNAL_TYPES.includes(bookingType)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !bookingDate) return
    setSaving(true)
    setSuccess(false)

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          booking_type: bookingType,
          provider: provider || null,
          booking_date: bookingDate,
          booking_time: bookingTime || null,
          notes: notes || null,
          cost: cost ? parseFloat(cost) : null,
        }),
      })

      if (res.ok) {
        setTitle('')
        setProvider('')
        setBookingDate('')
        setBookingTime('')
        setNotes('')
        setCost('')
        setSuccess(true)
        onCreated?.()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PlusCircle className="h-5 w-5" />
          New Booking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value)}
            >
              {BOOKING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <Input
              placeholder="Provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
            <Input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              required
            />
            <Input
              type="time"
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <Input
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {isExternal && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                This is an external booking. A human-in-the-loop (HITL) action will be created
                for confirmation before the booking is finalised.
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Booking'}
            </Button>
            {success && (
              <Badge variant="default">Booking created successfully</Badge>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

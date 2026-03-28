import { createClient } from '@/lib/supabase/server'
import { BookingCalendar } from '@/components/bookings/BookingCalendar'
import { BookingForm } from '@/components/bookings/BookingForm'
import { CalendarDays } from 'lucide-react'

export default async function BookingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('household_id', householdId)
    .order('booking_date', { ascending: true })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-900">Lifestyle Bookings</h1>
      </div>

      <BookingForm />
      <BookingCalendar bookings={bookings ?? []} />
    </div>
  )
}

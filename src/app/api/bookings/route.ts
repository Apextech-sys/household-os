import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_BOOKING_TYPES = ['restaurant', 'travel', 'service', 'event', 'other'] as const
const VALID_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const
const EXTERNAL_TYPES = ['restaurant', 'travel', 'service'] as const

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('booking_date', { ascending: true })

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, booking_type, provider, booking_date, booking_time, end_time, notes, cost, currency, reference_number } = body as Record<string, unknown>

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 422 })
  }
  if (!booking_type || !VALID_BOOKING_TYPES.includes(booking_type as typeof VALID_BOOKING_TYPES[number])) {
    return NextResponse.json({ error: `booking_type must be one of: ${VALID_BOOKING_TYPES.join(', ')}` }, { status: 422 })
  }
  if (!booking_date || typeof booking_date !== 'string') {
    return NextResponse.json({ error: 'booking_date is required' }, { status: 422 })
  }

  // Create HITL action for external bookings
  let hitlActionId: string | null = null
  if (EXTERNAL_TYPES.includes(booking_type as typeof EXTERNAL_TYPES[number])) {
    const { data: hitlAction, error: hitlError } = await supabase
      .from('hitl_actions')
      .insert({
        household_id: profile.household_id,
        action_type: 'booking_confirmation',
        title: `Confirm booking: ${title}`,
        description: `Please confirm the ${booking_type} booking for "${title}" at ${provider ?? 'unknown provider'} on ${booking_date}.`,
        status: 'pending',
        payload: { title, booking_type, provider, booking_date, booking_time },
      })
      .select('id')
      .single()

    if (!hitlError && hitlAction) {
      hitlActionId = hitlAction.id
    }
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      household_id: profile.household_id,
      hitl_action_id: hitlActionId,
      title,
      booking_type,
      provider: provider ?? null,
      booking_date,
      booking_time: booking_time ?? null,
      end_time: end_time ?? null,
      status: 'pending',
      reference_number: reference_number ?? null,
      notes: notes ?? null,
      cost: cost ?? null,
      currency: currency ?? 'ZAR',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'booking',
    entity_id: data.id,
    details: { title, booking_type, provider, booking_date },
  })

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, status } = body as Record<string, unknown>

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 422 })
  }
  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .eq('household_id', profile.household_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'update_status',
    entity_type: 'booking',
    entity_id: data.id,
    details: { status },
  })

  return NextResponse.json(data)
}

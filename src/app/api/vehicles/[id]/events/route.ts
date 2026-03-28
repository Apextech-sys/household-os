import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_EVENT_TYPES = [
  'service',
  'licence_renewal',
  'fine',
  'accident',
  'fuel',
  'toll',
  'parking',
  'wash',
] as const

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  // Verify vehicle belongs to this household
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', params.id)
    .eq('household_id', profile.household_id)
    .single()

  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('vehicle_events')
    .select('*')
    .eq('vehicle_id', params.id)
    .eq('household_id', profile.household_id)
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  // Verify vehicle belongs to this household
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', params.id)
    .eq('household_id', profile.household_id)
    .single()

  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event_type, description, amount, event_date, next_due_date, provider, document_id } =
    body as Record<string, unknown>

  if (!event_type || typeof event_type !== 'string') {
    return NextResponse.json({ error: 'event_type is required' }, { status: 422 })
  }
  if (!VALID_EVENT_TYPES.includes(event_type as typeof VALID_EVENT_TYPES[number])) {
    return NextResponse.json(
      { error: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
      { status: 422 }
    )
  }
  if (!event_date) {
    return NextResponse.json({ error: 'event_date is required' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('vehicle_events')
    .insert({
      household_id: profile.household_id,
      vehicle_id: params.id,
      event_type,
      description: description ?? null,
      amount: amount ?? null,
      event_date,
      next_due_date: next_due_date ?? null,
      provider: provider ?? null,
      document_id: document_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'vehicle_event',
    entity_id: data.id,
    details: { vehicle_id: params.id, event_type, event_date },
  })

  return NextResponse.json(data, { status: 201 })
}

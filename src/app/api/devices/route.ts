import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_DEVICE_TYPES = ['phone', 'laptop', 'tablet', 'tv', 'appliance', 'iot', 'other'] as const
const VALID_STATUSES = ['active', 'storage', 'repair', 'retired'] as const

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
    .from('devices')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('created_at', { ascending: false })

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

  const { name, device_type, brand, model, serial_number, purchase_date, purchase_price, currency, status, warranty_id, notes } = body as Record<string, unknown>

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 422 })
  }
  if (device_type && !VALID_DEVICE_TYPES.includes(device_type as typeof VALID_DEVICE_TYPES[number])) {
    return NextResponse.json(
      { error: `device_type must be one of: ${VALID_DEVICE_TYPES.join(', ')}` },
      { status: 422 }
    )
  }
  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('devices')
    .insert({
      household_id: profile.household_id,
      name,
      device_type: device_type ?? 'other',
      brand: brand ?? null,
      model: model ?? null,
      serial_number: serial_number ?? null,
      purchase_date: purchase_date ?? null,
      purchase_price: purchase_price ?? null,
      currency: currency ?? 'ZAR',
      status: status ?? 'active',
      warranty_id: warranty_id ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'device',
    entity_id: data.id,
    details: { name, device_type, brand, model },
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

  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (updates.device_type && !VALID_DEVICE_TYPES.includes(updates.device_type as typeof VALID_DEVICE_TYPES[number])) {
    return NextResponse.json(
      { error: `device_type must be one of: ${VALID_DEVICE_TYPES.join(', ')}` },
      { status: 422 }
    )
  }
  if (updates.status && !VALID_STATUSES.includes(updates.status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('devices')
    .update(updates)
    .eq('id', id)
    .eq('household_id', profile.household_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'update',
    entity_type: 'device',
    entity_id: data.id,
    details: updates,
  })

  return NextResponse.json(data)
}

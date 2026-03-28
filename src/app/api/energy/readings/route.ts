import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_TARIFF_TYPES = ['prepaid', 'postpaid', 'tou'] as const

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
    .from('energy_readings')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('reading_date', { ascending: false })

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

  const { reading_date, kwh_consumed, kwh_solar_generated, cost_zar, tariff_type, meter_number, notes } = body as Record<string, unknown>

  if (!reading_date || typeof reading_date !== 'string') {
    return NextResponse.json({ error: 'reading_date is required' }, { status: 422 })
  }
  if (kwh_consumed == null || typeof kwh_consumed !== 'number') {
    return NextResponse.json({ error: 'kwh_consumed is required and must be a number' }, { status: 422 })
  }
  if (tariff_type && !VALID_TARIFF_TYPES.includes(tariff_type as typeof VALID_TARIFF_TYPES[number])) {
    return NextResponse.json(
      { error: `tariff_type must be one of: ${VALID_TARIFF_TYPES.join(', ')}` },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('energy_readings')
    .insert({
      household_id: profile.household_id,
      reading_date,
      kwh_consumed,
      kwh_solar_generated: kwh_solar_generated ?? null,
      cost_zar: cost_zar ?? null,
      tariff_type: tariff_type ?? null,
      meter_number: meter_number ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'energy_reading',
    entity_id: data.id,
    details: { reading_date, kwh_consumed, tariff_type },
  })

  return NextResponse.json(data, { status: 201 })
}

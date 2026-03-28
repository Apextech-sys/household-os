import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

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
    .from('water_readings')
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

  const { reading_date, kl_consumed, cost_zar, meter_number, overnight_flow_detected, overnight_flow_litres, notes } = body as Record<string, unknown>

  if (!reading_date || typeof reading_date !== 'string') {
    return NextResponse.json({ error: 'reading_date is required' }, { status: 422 })
  }
  if (kl_consumed == null || typeof kl_consumed !== 'number') {
    return NextResponse.json({ error: 'kl_consumed is required and must be a number' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('water_readings')
    .insert({
      household_id: profile.household_id,
      reading_date,
      kl_consumed,
      cost_zar: cost_zar ?? null,
      meter_number: meter_number ?? null,
      overnight_flow_detected: overnight_flow_detected ?? false,
      overnight_flow_litres: overnight_flow_litres ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'water_reading',
    entity_id: data.id,
    details: { reading_date, kl_consumed, overnight_flow_detected },
  })

  return NextResponse.json(data, { status: 201 })
}

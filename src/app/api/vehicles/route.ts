import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_FINANCE_TYPES = ['owned', 'financed', 'leased', 'balloon'] as const

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
    .from('vehicles')
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

  const { make, model, year, registration, vin, licence_expiry, next_service_date, next_service_km, current_km, finance_type, balloon_amount, balloon_date, insurance_policy_id } = body as Record<string, unknown>

  if (!make || typeof make !== 'string') {
    return NextResponse.json({ error: 'make is required' }, { status: 422 })
  }
  if (!model || typeof model !== 'string') {
    return NextResponse.json({ error: 'model is required' }, { status: 422 })
  }
  if (finance_type && !VALID_FINANCE_TYPES.includes(finance_type as typeof VALID_FINANCE_TYPES[number])) {
    return NextResponse.json(
      { error: `finance_type must be one of: ${VALID_FINANCE_TYPES.join(', ')}` },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      household_id: profile.household_id,
      make,
      model,
      year: year ?? null,
      registration: registration ?? null,
      vin: vin ?? null,
      licence_expiry: licence_expiry ?? null,
      next_service_date: next_service_date ?? null,
      next_service_km: next_service_km ?? null,
      current_km: current_km ?? null,
      finance_type: finance_type ?? null,
      balloon_amount: balloon_amount ?? null,
      balloon_date: balloon_date ?? null,
      insurance_policy_id: insurance_policy_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'vehicle',
    entity_id: data.id,
    details: { make, model, year, registration },
  })

  return NextResponse.json(data, { status: 201 })
}

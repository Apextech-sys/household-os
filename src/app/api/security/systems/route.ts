import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_SYSTEM_TYPES = ['alarm', 'cctv', 'electric_fence', 'access_control', 'armed_response', 'other'] as const
const VALID_STATUSES = ['active', 'suspended', 'expired'] as const

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
    .from('security_systems')
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

  const { name, system_type, provider, account_number, monthly_cost, currency, contract_start, contract_end, certificate_expiry, status, notes } = body as Record<string, unknown>

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 422 })
  }
  if (!system_type || !VALID_SYSTEM_TYPES.includes(system_type as typeof VALID_SYSTEM_TYPES[number])) {
    return NextResponse.json(
      { error: `system_type must be one of: ${VALID_SYSTEM_TYPES.join(', ')}` },
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
    .from('security_systems')
    .insert({
      household_id: profile.household_id,
      name,
      system_type,
      provider: provider ?? null,
      account_number: account_number ?? null,
      monthly_cost: monthly_cost ?? null,
      currency: currency ?? 'ZAR',
      contract_start: contract_start ?? null,
      contract_end: contract_end ?? null,
      certificate_expiry: certificate_expiry ?? null,
      status: status ?? 'active',
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'security_system',
    entity_id: data.id,
    details: { name, system_type, provider },
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

  if (updates.system_type && !VALID_SYSTEM_TYPES.includes(updates.system_type as typeof VALID_SYSTEM_TYPES[number])) {
    return NextResponse.json(
      { error: `system_type must be one of: ${VALID_SYSTEM_TYPES.join(', ')}` },
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
    .from('security_systems')
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
    entity_type: 'security_system',
    entity_id: data.id,
    details: updates,
  })

  return NextResponse.json(data)
}

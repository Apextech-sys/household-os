import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_STATUSES = ['active', 'suspended', 'cancelled'] as const

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
    .from('isp_connections')
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

  const { provider, package_name, contracted_speed_mbps, monthly_cost, contract_end_date, status } = body as Record<string, unknown>

  if (!provider || typeof provider !== 'string') {
    return NextResponse.json({ error: 'provider is required' }, { status: 422 })
  }
  if (!package_name || typeof package_name !== 'string') {
    return NextResponse.json({ error: 'package_name is required' }, { status: 422 })
  }
  if (contracted_speed_mbps == null || typeof contracted_speed_mbps !== 'number') {
    return NextResponse.json({ error: 'contracted_speed_mbps is required and must be a number' }, { status: 422 })
  }
  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('isp_connections')
    .insert({
      household_id: profile.household_id,
      provider,
      package_name,
      contracted_speed_mbps,
      monthly_cost: monthly_cost ?? null,
      contract_end_date: contract_end_date ?? null,
      status: status ?? 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'isp_connection',
    entity_id: data.id,
    details: { provider, package_name, contracted_speed_mbps },
  })

  return NextResponse.json(data, { status: 201 })
}

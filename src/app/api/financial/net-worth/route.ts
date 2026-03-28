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
    .from('net_worth_snapshots')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('snapshot_date', { ascending: false })

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

  const { snapshot_date, total_assets, total_liabilities, net_worth, breakdown } = body as Record<string, unknown>

  if (!snapshot_date || typeof snapshot_date !== 'string') {
    return NextResponse.json({ error: 'snapshot_date is required' }, { status: 422 })
  }
  if (total_assets == null || typeof total_assets !== 'number') {
    return NextResponse.json({ error: 'total_assets is required' }, { status: 422 })
  }
  if (total_liabilities == null || typeof total_liabilities !== 'number') {
    return NextResponse.json({ error: 'total_liabilities is required' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .insert({
      household_id: profile.household_id,
      snapshot_date,
      total_assets,
      total_liabilities,
      net_worth: net_worth ?? (total_assets as number) - (total_liabilities as number),
      breakdown: breakdown ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'net_worth_snapshot',
    entity_id: data.id,
    details: { snapshot_date, total_assets, total_liabilities, net_worth: data.net_worth },
  })

  return NextResponse.json(data, { status: 201 })
}

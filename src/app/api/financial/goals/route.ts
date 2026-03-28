import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

const VALID_CATEGORIES = ['emergency_fund', 'retirement', 'education', 'property', 'holiday', 'vehicle', 'other'] as const
const VALID_STATUSES = ['active', 'achieved', 'paused', 'cancelled'] as const

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
    .from('financial_goals')
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

  const { name, target_amount, current_amount, currency, deadline, category, status } = body as Record<string, unknown>

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 422 })
  }
  if (target_amount == null || typeof target_amount !== 'number') {
    return NextResponse.json({ error: 'target_amount is required' }, { status: 422 })
  }
  if (category && !VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
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
    .from('financial_goals')
    .insert({
      household_id: profile.household_id,
      name,
      target_amount,
      current_amount: current_amount ?? 0,
      currency: currency ?? 'ZAR',
      deadline: deadline ?? null,
      category: category ?? 'other',
      status: status ?? 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'financial_goal',
    entity_id: data.id,
    details: { name, target_amount, category },
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

  if (updates.category && !VALID_CATEGORIES.includes(updates.category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
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
    .from('financial_goals')
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
    entity_type: 'financial_goal',
    entity_id: data.id,
    details: updates,
  })

  return NextResponse.json(data)
}

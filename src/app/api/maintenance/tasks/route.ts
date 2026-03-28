import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { safeError } from '@/lib/utils/api-error'
import { NextResponse } from 'next/server'

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const VALID_STATUSES = ['pending', 'scheduled', 'in_progress', 'complete', 'cancelled'] as const

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get('asset_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('maintenance_tasks')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('scheduled_date', { ascending: true })

  if (assetId) {
    query = query.eq('asset_id', assetId)
  }

  if (status) {
    if (!VALID_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { error: `status filter must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    query = query.eq('status', status)
  }

  const { data, error } = await query

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

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    asset_id, title, description, priority, status,
    scheduled_date, contractor_name, contractor_phone,
    estimated_cost,
  } = body as Record<string, any>

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (!priority || !VALID_PRIORITIES.includes(priority as any)) {
    return NextResponse.json(
      { error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` },
      { status: 400 }
    )
  }

  const resolvedStatus = status ?? 'pending'
  if (!VALID_STATUSES.includes(resolvedStatus as any)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data: task, error } = await supabase
    .from('maintenance_tasks')
    .insert({
      household_id: profile.household_id,
      asset_id: asset_id ?? null,
      title: title.trim(),
      description: description?.trim() ?? null,
      priority,
      status: resolvedStatus,
      scheduled_date: scheduled_date ?? null,
      contractor_name: contractor_name?.trim() ?? null,
      contractor_phone: contractor_phone?.trim() ?? null,
      estimated_cost: estimated_cost ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'maintenance_task.create',
    entity_type: 'maintenance_task',
    entity_id: task.id,
    details: { title: task.title, priority, status: resolvedStatus },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(task, { status: 201 })
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

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, status, priority, title, description, scheduled_date,
    contractor_name, contractor_phone, estimated_cost, actual_cost, completed_date } =
    body as Record<string, any>

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Verify ownership
  const { data: existing } = await supabase
    .from('maintenance_tasks')
    .select('id')
    .eq('id', id)
    .eq('household_id', profile.household_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  if (status && !VALID_STATUSES.includes(status as any)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  if (priority && !VALID_PRIORITIES.includes(priority as any)) {
    return NextResponse.json(
      { error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  if (status !== undefined) updates.status = status
  if (priority !== undefined) updates.priority = priority
  if (title !== undefined) updates.title = title?.trim()
  if (description !== undefined) updates.description = description?.trim() ?? null
  if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date ?? null
  if (contractor_name !== undefined) updates.contractor_name = contractor_name?.trim() ?? null
  if (contractor_phone !== undefined) updates.contractor_phone = contractor_phone?.trim() ?? null
  if (estimated_cost !== undefined) updates.estimated_cost = estimated_cost ?? null
  if (actual_cost !== undefined) updates.actual_cost = actual_cost ?? null
  if (completed_date !== undefined) updates.completed_date = completed_date ?? null

  const { data: task, error } = await supabase
    .from('maintenance_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'maintenance_task.update',
    entity_type: 'maintenance_task',
    entity_id: id,
    details: updates as Record<string, unknown>,
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(task)
}

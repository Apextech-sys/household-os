import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { searchParams } = new URL(request.url)
  const planId = searchParams.get('plan_id')

  let query = supabase
    .from('medical_claims')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('claim_date', { ascending: false })

  if (planId) {
    query = query.eq('plan_id', planId)
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

  const body = await request.json()
  const {
    plan_id,
    provider_name,
    claim_date,
    amount_billed,
    amount_paid,
    shortfall,
    category,
    status,
  } = body

  if (!plan_id || typeof plan_id !== 'string' || plan_id.trim() === '') {
    return NextResponse.json({ error: 'plan_id is required' }, { status: 400 })
  }
  if (!provider_name || typeof provider_name !== 'string' || provider_name.trim() === '') {
    return NextResponse.json({ error: 'provider_name is required' }, { status: 400 })
  }
  if (!claim_date) {
    return NextResponse.json({ error: 'claim_date is required' }, { status: 400 })
  }
  if (amount_billed == null) {
    return NextResponse.json({ error: 'amount_billed is required' }, { status: 400 })
  }

  const validStatuses = ['pending', 'approved', 'partially_paid', 'rejected']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const { data: claim, error } = await supabase
    .from('medical_claims')
    .insert({
      household_id: profile.household_id,
      plan_id: plan_id.trim(),
      provider_name: provider_name.trim(),
      claim_date,
      amount_billed,
      amount_paid: amount_paid ?? null,
      shortfall: shortfall ?? null,
      category: category ?? null,
      status: status ?? 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'medical_claim.create',
    entity_type: 'medical_claim',
    entity_id: claim.id,
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(claim, { status: 201 })
}

import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase
    .from('medical_aid_plans')
    .select('*')
    .eq('household_id', profile?.household_id)
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

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  const body = await request.json()
  const {
    scheme_name,
    plan_name,
    membership_number,
    principal_member,
    dependants,
    monthly_contribution,
    benefits,
    savings_balance,
    day_to_day_balance,
    renewal_date,
    document_id,
  } = body

  if (!scheme_name || typeof scheme_name !== 'string' || scheme_name.trim() === '') {
    return NextResponse.json({ error: 'scheme_name is required' }, { status: 400 })
  }
  if (!plan_name || typeof plan_name !== 'string' || plan_name.trim() === '') {
    return NextResponse.json({ error: 'plan_name is required' }, { status: 400 })
  }
  if (!membership_number || typeof membership_number !== 'string' || membership_number.trim() === '') {
    return NextResponse.json({ error: 'membership_number is required' }, { status: 400 })
  }
  if (!principal_member || typeof principal_member !== 'string' || principal_member.trim() === '') {
    return NextResponse.json({ error: 'principal_member is required' }, { status: 400 })
  }

  const { data: plan, error } = await supabase
    .from('medical_aid_plans')
    .insert({
      household_id: profile.household_id,
      scheme_name: scheme_name.trim(),
      plan_name: plan_name.trim(),
      membership_number: membership_number.trim(),
      principal_member: principal_member.trim(),
      dependants: dependants ?? null,
      monthly_contribution: monthly_contribution ?? null,
      benefits: benefits ?? null,
      savings_balance: savings_balance ?? null,
      day_to_day_balance: day_to_day_balance ?? null,
      renewal_date: renewal_date ?? null,
      document_id: document_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'medical_aid_plan.create',
    entity_type: 'medical_aid_plan',
    entity_id: plan.id,
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(plan, { status: 201 })
}

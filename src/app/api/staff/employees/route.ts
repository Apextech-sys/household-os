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

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('domestic_employees')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  // Mask id_number_encrypted — never return raw value
  const masked = (data ?? []).map(({ id_number_encrypted, ...rest }) => ({
    ...rest,
    id_number_masked: id_number_encrypted
      ? `****${id_number_encrypted.slice(-4)}`
      : null,
  }))

  return NextResponse.json(masked)
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

  const { full_name, id_number_encrypted, role, start_date, salary_amount, salary_frequency, uif_registered, uif_reference, leave_days_annual, contract_document_id } = body as Record<string, unknown>

  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ error: 'full_name is required' }, { status: 422 })
  }

  const VALID_ROLES = ['domestic_worker', 'gardener', 'nanny', 'driver', 'other'] as const
  if (!role || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 422 })
  }

  const VALID_FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const
  if (salary_frequency && !VALID_FREQUENCIES.includes(salary_frequency as typeof VALID_FREQUENCIES[number])) {
    return NextResponse.json({ error: `salary_frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('domestic_employees')
    .insert({
      household_id: profile.household_id,
      full_name,
      id_number_encrypted: id_number_encrypted ?? null,
      role,
      start_date: start_date ?? null,
      salary_amount: salary_amount ?? null,
      salary_frequency: salary_frequency ?? 'monthly',
      uif_registered: uif_registered ?? false,
      uif_reference: uif_reference ?? null,
      leave_days_annual: leave_days_annual ?? 15,
      leave_days_used: 0,
      status: 'active',
      contract_document_id: contract_document_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'employee.create',
    entity_type: 'domestic_employee',
    entity_id: data.id,
    details: { full_name, role },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(data, { status: 201 })
}

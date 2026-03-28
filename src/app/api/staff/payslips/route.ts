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
    .from('payslips')
    .select('*, domestic_employees(full_name, role)')
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

  const { employee_id, period_start, period_end, basic_salary, uif_deduction, other_deductions } = body as Record<string, unknown>

  if (!employee_id || typeof employee_id !== 'string') {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 422 })
  }
  if (!period_start || !period_end) {
    return NextResponse.json({ error: 'period_start and period_end are required' }, { status: 422 })
  }
  if (basic_salary == null || typeof basic_salary !== 'number') {
    return NextResponse.json({ error: 'basic_salary is required' }, { status: 422 })
  }

  // Verify employee belongs to household
  const { data: employee } = await supabase
    .from('domestic_employees')
    .select('id')
    .eq('id', employee_id)
    .eq('household_id', profile.household_id)
    .single()

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  const uifAmount = typeof uif_deduction === 'number' ? uif_deduction : 0
  const otherAmount = typeof other_deductions === 'number' ? other_deductions : 0
  const netPay = basic_salary - uifAmount - otherAmount

  const { data, error } = await supabase
    .from('payslips')
    .insert({
      household_id: profile.household_id,
      employee_id,
      period_start,
      period_end,
      basic_salary,
      uif_deduction: uifAmount,
      other_deductions: otherAmount,
      net_pay: netPay,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'payslip.create',
    entity_type: 'payslip',
    entity_id: data.id,
    details: { employee_id, period_start, period_end, net_pay: netPay },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(data, { status: 201 })
}

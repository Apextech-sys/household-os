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

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const account_id = searchParams.get('account_id')

  let query = supabase
    .from('utility_bills')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('bill_date', { ascending: false })

  if (account_id) {
    query = query.eq('account_id', account_id)
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
    account_id,
    document_id,
    bill_date,
    due_date,
    total_amount,
    line_items,
    consumption,
    is_anomalous,
    anomaly_details,
  } = body

  if (!account_id || typeof account_id !== 'string') {
    return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  }
  if (!bill_date) {
    return NextResponse.json({ error: 'bill_date is required' }, { status: 400 })
  }
  if (!due_date) {
    return NextResponse.json({ error: 'due_date is required' }, { status: 400 })
  }
  if (total_amount === undefined || total_amount === null || isNaN(Number(total_amount))) {
    return NextResponse.json({ error: 'total_amount must be a number' }, { status: 400 })
  }

  // Verify account belongs to this household
  const { data: account } = await supabase
    .from('utility_accounts')
    .select('id')
    .eq('id', account_id)
    .eq('household_id', profile.household_id)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const { data: bill, error } = await supabase
    .from('utility_bills')
    .insert({
      household_id: profile.household_id,
      account_id,
      document_id: document_id ?? null,
      bill_date,
      due_date,
      total_amount: Number(total_amount),
      line_items: line_items ?? null,
      consumption: consumption ?? null,
      is_anomalous: is_anomalous ?? false,
      anomaly_details: anomaly_details ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'utility_bill.create',
    entity_type: 'utility_bill',
    entity_id: bill.id,
    details: { account_id, bill_date, due_date, total_amount, is_anomalous },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(bill, { status: 201 })
}

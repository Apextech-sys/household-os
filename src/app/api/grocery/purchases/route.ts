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
    .from('grocery_purchases')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('purchase_date', { ascending: false })

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

  const { retailer, purchase_date, total_amount, currency, items, receipt_id } = body as Record<string, unknown>

  if (!retailer || typeof retailer !== 'string') {
    return NextResponse.json({ error: 'retailer is required' }, { status: 422 })
  }
  if (!purchase_date || typeof purchase_date !== 'string') {
    return NextResponse.json({ error: 'purchase_date is required' }, { status: 422 })
  }
  if (total_amount == null || typeof total_amount !== 'number') {
    return NextResponse.json({ error: 'total_amount is required and must be a number' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('grocery_purchases')
    .insert({
      household_id: profile.household_id,
      retailer,
      purchase_date,
      total_amount,
      currency: currency ?? 'ZAR',
      items: items ?? null,
      receipt_id: receipt_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'grocery_purchase',
    entity_id: data.id,
    details: { retailer, purchase_date, total_amount },
  })

  return NextResponse.json(data, { status: 201 })
}

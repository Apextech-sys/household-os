import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  // Verify the card belongs to this household
  const { data: card } = await supabase
    .from('credit_cards')
    .select('id')
    .eq('id', params.id)
    .eq('household_id', profile?.household_id)
    .single()

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('purchase_protections')
    .select('*')
    .eq('credit_card_id', params.id)
    .eq('household_id', profile?.household_id)
    .order('protection_expiry', { ascending: true })

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  // Verify the card belongs to this household
  const { data: card } = await supabase
    .from('credit_cards')
    .select('id')
    .eq('id', params.id)
    .eq('household_id', profile.household_id)
    .single()

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const body = await request.json()
  const { item_description, purchase_date, protection_expiry, amount, receipt_id, status } = body

  if (!item_description || typeof item_description !== 'string' || item_description.trim() === '') {
    return NextResponse.json({ error: 'item_description is required' }, { status: 400 })
  }
  if (!purchase_date) {
    return NextResponse.json({ error: 'purchase_date is required' }, { status: 400 })
  }
  if (!protection_expiry) {
    return NextResponse.json({ error: 'protection_expiry is required' }, { status: 400 })
  }
  if (amount == null || isNaN(Number(amount))) {
    return NextResponse.json({ error: 'amount is required and must be a number' }, { status: 400 })
  }

  const allowedStatuses = ['active', 'expired', 'claimed']
  const resolvedStatus = allowedStatuses.includes(status) ? status : 'active'

  const { data: protection, error } = await supabase
    .from('purchase_protections')
    .insert({
      household_id: profile.household_id,
      credit_card_id: params.id,
      receipt_id: receipt_id ?? null,
      item_description: item_description.trim(),
      purchase_date,
      protection_expiry,
      amount: Number(amount),
      status: resolvedStatus,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'purchase_protection.create',
    entity_type: 'purchase_protection',
    entity_id: protection.id,
    details: { credit_card_id: params.id },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(protection, { status: 201 })
}

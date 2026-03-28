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
    .from('credit_cards')
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
  const { card_name, card_type, benefits, purchase_protection_days, warranty_extension_months, travel_insurance, annual_fee, bank_account_id } = body

  if (!card_name || typeof card_name !== 'string' || card_name.trim() === '') {
    return NextResponse.json({ error: 'card_name is required' }, { status: 400 })
  }
  if (!card_type || typeof card_type !== 'string' || card_type.trim() === '') {
    return NextResponse.json({ error: 'card_type is required' }, { status: 400 })
  }

  const { data: card, error } = await supabase
    .from('credit_cards')
    .insert({
      household_id: profile.household_id,
      bank_account_id: bank_account_id ?? null,
      card_name: card_name.trim(),
      card_type: card_type.trim(),
      benefits: benefits ?? null,
      purchase_protection_days: purchase_protection_days ?? null,
      warranty_extension_months: warranty_extension_months ?? null,
      travel_insurance: travel_insurance ?? null,
      annual_fee: annual_fee ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'credit_card.create',
    entity_type: 'credit_card',
    entity_id: card.id,
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(card, { status: 201 })
}

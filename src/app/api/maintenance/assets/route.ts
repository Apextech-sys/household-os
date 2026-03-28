import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { safeError } from '@/lib/utils/api-error'
import { NextResponse } from 'next/server'

const VALID_CATEGORIES = [
  'appliance', 'plumbing', 'electrical', 'hvac', 'structural',
  'garden', 'pool', 'security', 'solar', 'geyser', 'other',
] as const

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  const { data, error } = await supabase
    .from('home_assets')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('name', { ascending: true })

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

  const { name, category, brand, model, purchase_date, warranty_id, expected_lifespan_years,
    last_service_date, next_service_date, notes } = body as Record<string, any>

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (!category || !VALID_CATEGORIES.includes(category as any)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data: asset, error } = await supabase
    .from('home_assets')
    .insert({
      household_id: profile.household_id,
      name: name.trim(),
      category,
      brand: brand?.trim() ?? null,
      model: model?.trim() ?? null,
      purchase_date: purchase_date ?? null,
      warranty_id: warranty_id ?? null,
      expected_lifespan_years: expected_lifespan_years ?? null,
      last_service_date: last_service_date ?? null,
      next_service_date: next_service_date ?? null,
      notes: notes?.trim() ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'home_asset.create',
    entity_type: 'home_asset',
    entity_id: asset.id,
    details: { name: asset.name, category: asset.category },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(asset, { status: 201 })
}

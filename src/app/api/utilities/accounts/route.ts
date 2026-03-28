import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

const VALID_UTILITY_TYPES = ['electricity', 'water', 'rates', 'refuse', 'sewerage', 'combined'] as const
type UtilityType = typeof VALID_UTILITY_TYPES[number]

function isValidUtilityType(value: unknown): value is UtilityType {
  return typeof value === 'string' && (VALID_UTILITY_TYPES as readonly string[]).includes(value)
}

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
    .from('utility_accounts')
    .select('*')
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

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  const body = await request.json()
  const { provider, account_number, utility_type, municipality, property_address } = body

  if (!provider || typeof provider !== 'string') {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 })
  }
  if (!account_number || typeof account_number !== 'string') {
    return NextResponse.json({ error: 'account_number is required' }, { status: 400 })
  }
  if (!isValidUtilityType(utility_type)) {
    return NextResponse.json(
      { error: `utility_type must be one of: ${VALID_UTILITY_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data: account, error } = await supabase
    .from('utility_accounts')
    .insert({
      household_id: profile.household_id,
      provider,
      account_number,
      utility_type,
      municipality: municipality ?? null,
      property_address: property_address ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'utility_account.create',
    entity_type: 'utility_account',
    entity_id: account.id,
    details: { provider, account_number, utility_type, municipality },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(account, { status: 201 })
}

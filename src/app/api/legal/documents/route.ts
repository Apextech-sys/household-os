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
    .from('legal_documents')
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

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { document_id, title, document_type, parties, effective_date, expiry_date } = body as Record<string, unknown>

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 422 })
  }

  const VALID_TYPES = ['lease', 'contract', 'agreement', 'policy', 'notice', 'other'] as const
  if (!document_type || !VALID_TYPES.includes(document_type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: `document_type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('legal_documents')
    .insert({
      household_id: profile.household_id,
      document_id: document_id ?? null,
      title,
      document_type,
      parties: parties ?? [],
      effective_date: effective_date ?? null,
      expiry_date: expiry_date ?? null,
      summary: null,
      red_flags: [],
      analysis_status: 'pending',
      analysed_at: null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'legal_document.create',
    entity_type: 'legal_document',
    entity_id: data.id,
    details: { title, document_type },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(data, { status: 201 })
}

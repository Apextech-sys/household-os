import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const connectionSchema = z.object({
  bank_name: z.string().min(1),
  bank_code: z.enum(['fnb', 'investec', 'absa', 'standard_bank', 'nedbank', 'capitec']),
  connection_type: z.enum(['api', 'statement_import']),
  api_credentials_encrypted: z.record(z.string(), z.unknown()).optional(),
})

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
    .from('bank_connections')
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
  const parsed = connectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bank_connections')
    .insert({
      household_id: profile.household_id,
      bank_name: parsed.data.bank_name,
      bank_code: parsed.data.bank_code,
      connection_type: parsed.data.connection_type,
      api_credentials_encrypted: parsed.data.api_credentials_encrypted ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'banking.connection.create',
    entity_type: 'bank_connection',
    entity_id: data.id,
    details: { bank_name: parsed.data.bank_name, bank_code: parsed.data.bank_code, connection_type: parsed.data.connection_type },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(data, { status: 201 })
}

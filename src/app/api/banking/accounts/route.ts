import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
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

  const { searchParams } = new URL(request.url)
  const connectionId = searchParams.get('connection_id')

  let query = supabase
    .from('bank_accounts')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  if (connectionId) {
    query = query.eq('connection_id', connectionId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
  return NextResponse.json(data)
}

import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*, inbox_addresses(label, email_address), inbox_attachments(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 404 })
  return NextResponse.json(data)
}

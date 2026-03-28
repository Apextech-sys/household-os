import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  if (profile) {
    await logAudit(supabase, {
      household_id: profile.household_id,
      user_id: user.id,
      action: 'document.delete',
      entity_type: 'document',
      entity_id: params.id,
      ip_address: request.headers.get('x-forwarded-for'),
    })
  }

  return NextResponse.json({ success: true })
}

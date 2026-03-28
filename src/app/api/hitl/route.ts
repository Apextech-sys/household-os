import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const hitlSchema = z.object({
  action_id: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
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
    .from('hitl_actions')
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

  const body = await request.json()
  const parsed = hitlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { action_id, decision } = parsed.data

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (decision === 'approve') {
    const { error } = await supabase
      .from('hitl_actions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', action_id)
      .eq('status', 'proposed')

    if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
  } else if (decision === 'reject') {
    const { error } = await supabase
      .from('hitl_actions')
      .update({ status: 'rejected' })
      .eq('id', action_id)
      .eq('status', 'proposed')

    if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
  }

  if (profile) {
    await logAudit(supabase, {
      household_id: profile.household_id,
      user_id: user.id,
      action: decision === 'approve' ? 'hitl.approve' : 'hitl.reject',
      entity_type: 'hitl_action',
      entity_id: action_id,
      details: { decision },
      ip_address: request.headers.get('x-forwarded-for'),
    })
  }

  return NextResponse.json({ success: true })
}

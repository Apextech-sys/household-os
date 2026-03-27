import { createClient } from '@/lib/supabase/server'
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
    .from('hitl_actions')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action_id, decision } = await request.json()

  if (decision === 'approve') {
    const { error } = await supabase
      .from('hitl_actions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', action_id)
      .eq('status', 'proposed')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (decision === 'reject') {
    const { error } = await supabase
      .from('hitl_actions')
      .update({ status: 'rejected' })
      .eq('id', action_id)
      .eq('status', 'proposed')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

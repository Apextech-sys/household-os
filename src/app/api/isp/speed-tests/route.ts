import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeError } from '@/lib/utils/api-error'
import { logAudit } from '@/lib/audit'

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
    .from('speed_tests')
    .select('*')
    .eq('household_id', profile.household_id)
    .order('tested_at', { ascending: false })

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

  const { connection_id, download_mbps, upload_mbps, latency_ms, tested_at } = body as Record<string, unknown>

  if (!connection_id || typeof connection_id !== 'string') {
    return NextResponse.json({ error: 'connection_id is required' }, { status: 422 })
  }
  if (download_mbps == null || typeof download_mbps !== 'number') {
    return NextResponse.json({ error: 'download_mbps is required and must be a number' }, { status: 422 })
  }
  if (upload_mbps == null || typeof upload_mbps !== 'number') {
    return NextResponse.json({ error: 'upload_mbps is required and must be a number' }, { status: 422 })
  }
  if (latency_ms == null || typeof latency_ms !== 'number') {
    return NextResponse.json({ error: 'latency_ms is required and must be a number' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('speed_tests')
    .insert({
      household_id: profile.household_id,
      connection_id,
      download_mbps,
      upload_mbps,
      latency_ms,
      tested_at: tested_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'create',
    entity_type: 'speed_test',
    entity_id: data.id,
    details: { connection_id, download_mbps, upload_mbps, latency_ms },
  })

  return NextResponse.json(data, { status: 201 })
}

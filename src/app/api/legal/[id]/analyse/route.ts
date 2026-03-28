import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  // Load the legal document
  const { data: doc, error: docError } = await supabase
    .from('legal_documents')
    .select('*')
    .eq('id', params.id)
    .eq('household_id', profile.household_id)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Set analysis_status to 'analysing' — actual AI processing is async
  const { error: updateError } = await supabase
    .from('legal_documents')
    .update({ analysis_status: 'analysing' })
    .eq('id', params.id)
    .eq('household_id', profile.household_id)

  if (updateError) {
    return NextResponse.json({ error: safeError(updateError) }, { status: 500 })
  }

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'legal_document.analyse',
    entity_type: 'legal_document',
    entity_id: params.id,
    details: { title: doc.title, document_type: doc.document_type },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json({ status: 'analysing', id: params.id })
}

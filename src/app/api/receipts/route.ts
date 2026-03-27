import { safeError } from '@/lib/utils/api-error'
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
    .from('receipts')
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

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, PDF' }, { status: 415 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB' }, { status: 400 })
  }
  if (!file.name || file.name.length > 255) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const imagePath = `receipts/${profile.household_id}/${crypto.randomUUID()}/${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(imagePath, fileBuffer, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: safeError(uploadError) }, { status: 500 })

  const { data: receipt, error: insertError } = await supabase
    .from('receipts')
    .insert({
      household_id: profile.household_id,
      uploaded_by: user.id,
      image_path: imagePath,
      status: 'uploading',
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: safeError(insertError) }, { status: 500 })

  // Audit log
  await supabase.from('audit_logs').insert({
    action: 'upload',
    resource_type: 'receipt',
    resource_id: receipt.id,
    user_id: user.id,
  }).then(({ error: auditErr }) => {
    if (auditErr) console.error('[Audit] Failed to write audit log:', auditErr)
  })

  return NextResponse.json(receipt, { status: 201 })
}

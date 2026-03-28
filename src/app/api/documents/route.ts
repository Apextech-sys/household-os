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

  const { data, error } = await supabase
    .from('documents')
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

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, JPEG, PNG, WebP, HEIC' }, { status: 415 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 20MB' }, { status: 400 })
  }
  if (!file.name || file.name.length > 255) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const filePath = `documents/${profile.household_id}/${crypto.randomUUID()}/${file.name}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, fileBuffer, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: safeError(uploadError) }, { status: 500 })

  // Insert document record
  const { data: doc, error: insertError } = await supabase
    .from('documents')
    .insert({
      household_id: profile.household_id,
      uploaded_by: user.id,
      filename: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      status: 'uploading',
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: safeError(insertError) }, { status: 500 })

  // Audit log
  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'document.upload',
    entity_type: 'document',
    entity_id: doc.id,
    details: { filename: file.name, file_size: file.size, mime_type: file.type },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(doc, { status: 201 })
}

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createHmac, timingSafeEqual } from 'crypto'

function createServiceClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}

export async function POST(request: Request) {
  // Read raw body for HMAC verification (must be done before .json())
  const rawBody = await request.text()

  // Verify Postmark webhook signature using HMAC-SHA256
  const webhookToken = process.env.POSTMARK_WEBHOOK_TOKEN
  if (!webhookToken) {
    console.warn('[Postmark] POSTMARK_WEBHOOK_TOKEN is not set — skipping signature verification (dev mode)')
  } else {
    const signature = request.headers.get('x-postmark-signature') ?? ''
    const expectedSig = createHmac('sha256', webhookToken).update(rawBody).digest('hex')
    let sigValid = false
    try {
      sigValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    } catch {
      // Buffer lengths differ → invalid
    }
    if (!sigValid) {
      console.warn('[Postmark] Webhook signature mismatch')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const payload = JSON.parse(rawBody)
  const supabase = createServiceClient()

  const toAddress = payload.To?.toLowerCase()
  const { data: inboxAddr } = await supabase
    .from('inbox_addresses')
    .select('id, household_id')
    .eq('email_address', toAddress)
    .eq('is_active', true)
    .single()

  if (!inboxAddr) return new Response('Not found', { status: 404 })

  // Insert message
  const { data: message } = await supabase
    .from('inbox_messages')
    .insert({
      household_id: inboxAddr.household_id,
      inbox_address_id: inboxAddr.id,
      from_email: payload.From,
      subject: payload.Subject,
      body: payload.TextBody ?? payload.HtmlBody,
      raw_payload: payload,
      status: 'processing',
    })
    .select()
    .single()

  if (!message) return new Response('Insert failed', { status: 500 })

  // Process attachments
  for (const attachment of payload.Attachments ?? []) {
    try {
      const bytes = Buffer.from(attachment.Content, 'base64')
      const filePath = `inbox/${inboxAddr.household_id}/${message.id}/${attachment.Name}`

      await supabase.storage.from('documents').upload(filePath, bytes, {
        contentType: attachment.ContentType,
      })

      await supabase.from('inbox_attachments').insert({
        message_id: message.id,
        household_id: inboxAddr.household_id,
        filename: attachment.Name,
        file_path: filePath,
        file_size: bytes.length,
        mime_type: attachment.ContentType,
      })

      // Try to parse as bank statement
      if (attachment.ContentType?.includes('pdf') || attachment.ContentType?.includes('image')) {
        try {
          const { text } = await generateText({
            model: anthropic('claude-opus-4-5'),
            messages: [{
              role: 'user',
              content: [
                { type: 'image', image: attachment.Content, mediaType: attachment.ContentType },
                {
                  type: 'text',
                  text: `Extract bank statement data from this document. Return ONLY valid JSON:
{
  "bank_name": "ABSA | Standard Bank | Nedbank | Capitec | FNB | Other",
  "account_number": "string (last 4 digits only)",
  "statement_period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "opening_balance": 0.00,
  "closing_balance": 0.00,
  "currency": "ZAR",
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "string", "amount": 0.00, "is_debit": true, "reference": "string | null" }
  ]
}
Return ONLY the JSON. No explanation.`,
                },
              ],
            }],
            maxOutputTokens: 4096,
          })

          const parsed = JSON.parse(text)

          await supabase.from('inbox_messages').update({
            parsed_data: parsed,
            status: 'parsed',
          }).eq('id', message.id)

          // Insert budget transactions
          if (parsed?.transactions?.length) {
            const rows = parsed.transactions.map((t: any) => ({
              household_id: inboxAddr.household_id,
              source: 'statement' as const,
              description: t.description,
              amount: Math.abs(t.amount),
              transaction_date: t.date,
              is_income: !t.is_debit,
              statement_ref: t.reference ?? null,
              category: null,
            }))
            await supabase.from('budget_transactions').insert(rows)
          }
        } catch {
          await supabase.from('inbox_messages').update({ status: 'error' }).eq('id', message.id)
        }
      }
    } catch (err) {
      console.error('Attachment processing error:', err)
    }
  }

  // If no attachments, mark as parsed
  if (!payload.Attachments?.length) {
    await supabase.from('inbox_messages').update({ status: 'parsed' }).eq('id', message.id)
  }

  return new Response('OK', { status: 200 })
}

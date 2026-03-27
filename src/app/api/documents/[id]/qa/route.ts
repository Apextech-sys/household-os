import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { logAiUsage } from '@/lib/ai/log-usage'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: doc } = await supabase
    .from('documents')
    .select('ocr_text, extracted_data, filename, household_id')
    .eq('id', params.id)
    .single()

  if (!doc) return new Response('Not found', { status: 404 })

  const { messages, session_id } = await request.json()
  const userMessage = messages[messages.length - 1]?.content ?? ''

  // Create or reuse session
  let sessionId = session_id
  if (!sessionId) {
    const { data: session } = await supabase
      .from('document_qa_sessions')
      .insert({
        document_id: params.id,
        user_id: user.id,
        household_id: doc.household_id,
      })
      .select()
      .single()
    sessionId = session?.id
  }

  // Load prior messages
  const { data: priorMessages } = session_id
    ? await supabase
        .from('document_qa_messages')
        .select('role, content')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true })
        .limit(20)
    : { data: [] }

  const systemPrompt = `You are a document assistant for HouseholdOS. Answer questions accurately based ONLY on the document provided.

DOCUMENT: ${doc.filename}

OCR TEXT:
${doc.ocr_text ?? '(no text extracted)'}

EXTRACTED DATA:
${JSON.stringify(doc.extracted_data ?? {}, null, 2)}

Rules:
- Answer only from the document content above
- If the answer is not in the document, say so clearly
- Quote relevant sections when helpful
- For amounts, always include currency
- For dates, use DD Month YYYY format`

  const allMessages = [
    ...(priorMessages ?? []).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...messages,
  ]

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages: allMessages,
    maxOutputTokens: 1024,
    onFinish: async ({ text, usage }) => {
      await supabase.from('document_qa_messages').insert([
        { session_id: sessionId, household_id: doc.household_id, role: 'user', content: userMessage },
        { session_id: sessionId, household_id: doc.household_id, role: 'assistant', content: text },
      ])
      await logAiUsage(supabase, {
        householdId: doc.household_id,
        userId: user.id,
        model: 'claude-sonnet-4-5',
        endpoint: `/api/documents/${params.id}/qa`,
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
      })
    },
  })

  const response = result.toTextStreamResponse()
  response.headers.set('x-session-id', sessionId ?? '')
  return response
}

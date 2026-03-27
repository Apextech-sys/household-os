import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import OpenAI from 'openai'
import { logAiUsage } from '@/lib/ai/log-usage'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get document
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update status to processing
  await supabase.from('documents').update({ status: 'processing' }).eq('id', params.id)

  try {
    // Download file from storage
    const { data: fileData } = await supabase.storage
      .from('documents')
      .download(doc.file_path)

    if (!fileData) throw new Error('File not found in storage')

    const bytes = Buffer.from(await fileData.arrayBuffer())
    const base64 = bytes.toString('base64')

    // Claude Vision OCR + extraction
    const { text, usage } = await generateText({
      model: anthropic('claude-opus-4-5'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: base64,
              mediaType: doc.mime_type as 'image/jpeg' | 'image/png' | 'application/pdf',
            },
            {
              type: 'text',
              text: `You are a document intelligence system. Perform two tasks:

TASK 1 — Full OCR: Extract every word from this document verbatim. Preserve layout where possible.

TASK 2 — Structured Extraction: Extract and return a JSON block at the end in this exact format:
\`\`\`json
{
  "document_type": "<contract|invoice|statement|receipt|policy|legal|municipal|other>",
  "dates": ["YYYY-MM-DD", ...],
  "amounts": [{ "value": 0.00, "currency": "ZAR", "label": "string" }, ...],
  "parties": ["string", ...],
  "key_terms": ["string", ...]
}
\`\`\`

Return the OCR text first, then the JSON block.`,
            },
          ],
        },
      ],
      maxOutputTokens: 4096,
    })

    // Parse response
    const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/)
    const extractedData = jsonMatch ? JSON.parse(jsonMatch[1]) : null
    const ocrText = jsonMatch ? text.slice(0, text.indexOf('```json')).trim() : text

    // Generate embedding
    const embeddingInput = [
      ocrText.slice(0, 8000),
      JSON.stringify(extractedData),
    ].join('\n\n')

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingInput,
    })

    const embedding = embeddingResponse.data[0].embedding

    // Update document
    await supabase
      .from('documents')
      .update({
        ocr_text: ocrText,
        extracted_data: extractedData,
        embedding: JSON.stringify(embedding),
        status: 'ready',
      })
      .eq('id', params.id)

    // Log AI usage
    await logAiUsage(supabase, {
      householdId: doc.household_id,
      userId: user.id,
      model: 'claude-opus-4-5',
      endpoint: `/api/documents/${params.id}/process`,
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
    })

    return NextResponse.json({ success: true, status: 'ready' })
  } catch (error) {
    await supabase.from('documents').update({ status: 'error' }).eq('id', params.id)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

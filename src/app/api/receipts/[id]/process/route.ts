import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { logAiUsage } from '@/lib/ai/log-usage'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: receipt } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('receipts').update({ status: 'processing' }).eq('id', params.id)

  try {
    const { data: fileData } = await supabase.storage
      .from('documents')
      .download(receipt.image_path)

    if (!fileData) throw new Error('File not found')

    const bytes = Buffer.from(await fileData.arrayBuffer())
    const base64 = bytes.toString('base64')

    const { text, usage } = await generateText({
      model: anthropic('claude-opus-4-5'),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image: base64, mediaType: 'image/jpeg' as const },
          {
            type: 'text',
            text: `Extract receipt data from this image. Return ONLY valid JSON:
{
  "status": "ok",
  "retailer": "string | null",
  "purchase_date": "YYYY-MM-DD | null",
  "total_amount": 0.00,
  "currency": "ZAR",
  "items": [{ "name": "string", "price": 0.00, "qty": 1 }],
  "warranty_candidates": [{ "product_name": "string", "category": "electronics|appliance|other", "estimated_warranty_months": 24 }]
}
Return ONLY the JSON. No explanation.`,
          },
        ],
      }],
      maxOutputTokens: 1024,
    })

    let receiptData: any
    try {
      receiptData = JSON.parse(text)
    } catch {
      const jsonMatch = text.match(/\{[\s\S]+\}/)
      receiptData = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    }

    if (!receiptData) throw new Error('Failed to parse receipt data')

    await supabase
      .from('receipts')
      .update({
        ocr_text: JSON.stringify(receiptData.items),
        retailer: receiptData.retailer,
        purchase_date: receiptData.purchase_date,
        total_amount: receiptData.total_amount,
        currency: receiptData.currency ?? 'ZAR',
        items: receiptData.items,
        status: receiptData.status === 'error' ? 'error' : 'ready',
      })
      .eq('id', params.id)

    // Create warranty records
    if (receiptData.warranty_candidates?.length && receiptData.purchase_date) {
      const purchaseDate = new Date(receiptData.purchase_date)
      const warrantyInserts = receiptData.warranty_candidates.map((w: any) => {
        const expiry = new Date(purchaseDate)
        expiry.setMonth(expiry.getMonth() + (w.estimated_warranty_months || 6))
        return {
          receipt_id: params.id,
          household_id: receipt.household_id,
          product_name: w.product_name,
          warranty_months: w.estimated_warranty_months || 6,
          expiry_date: expiry.toISOString().split('T')[0],
        }
      })
      await supabase.from('warranties').insert(warrantyInserts)
    }

    await logAiUsage(supabase, {
      householdId: receipt.household_id,
      userId: user.id,
      model: 'claude-opus-4-5',
      endpoint: `/api/receipts/${params.id}/process`,
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    await supabase.from('receipts').update({ status: 'error' }).eq('id', params.id)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

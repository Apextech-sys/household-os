import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { logAiUsage } from '@/lib/ai/log-usage'

async function buildHouseholdContext(supabase: any, householdId: string): Promise<string> {
  const [docs, warranties, recentTx, inbox] = await Promise.all([
    supabase
      .from('documents')
      .select('filename, extracted_data')
      .eq('household_id', householdId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('warranties')
      .select('product_name, expiry_date, alert_sent')
      .eq('household_id', householdId)
      .gte('expiry_date', new Date().toISOString().split('T')[0])
      .order('expiry_date')
      .limit(10),
    supabase
      .from('budget_transactions')
      .select('description, amount, is_income, transaction_date, category')
      .eq('household_id', householdId)
      .order('transaction_date', { ascending: false })
      .limit(5),
    supabase
      .from('inbox_messages')
      .select('from_email, subject, received_at')
      .eq('household_id', householdId)
      .order('received_at', { ascending: false })
      .limit(5),
  ])

  return JSON.stringify({
    document_count: docs.data?.length ?? 0,
    documents: docs.data,
    active_warranties: warranties.data,
    recent_transactions: recentTx.data,
    recent_inbox: inbox.data,
  })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) return new Response('No household', { status: 400 })

  const { messages } = await request.json()

  const householdContext = await buildHouseholdContext(supabase, profile.household_id)

  const systemPrompt = `You are the HouseholdOS AI assistant. You have access to the following modules:

MODULES:
- document_qa: Questions about uploaded documents (leases, contracts, policies)
- receipt_lookup: Finding purchases, warranties, specific items bought
- budget: Income/expense questions, category summaries, spending trends
- warranty_check: Product warranty status and expiry
- inbox: Questions about received statements or emails
- general: General household advice, platform help

HOUSEHOLD CONTEXT:
${householdContext}

ROUTING RULES:
1. Classify the user's intent to one module
2. For document questions, identify which document (by filename or type)
3. For budget questions, identify the time period
4. Always respond in plain language
5. If multiple modules are needed, synthesise a single coherent answer
6. For consequential actions (disputes, claims, bookings), inform the user that a HITL action proposal will be created

POPIA / FSCA COMPLIANCE:
- You provide information only — never financial advice
- Never reveal account numbers in full
- All data is private to this household`

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages,
    maxOutputTokens: 2048,
    onFinish: async ({ usage }) => {
      await logAiUsage(supabase, {
        householdId: profile.household_id,
        userId: user.id,
        model: 'claude-sonnet-4-5',
        endpoint: '/api/chat',
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
      })
    },
  })

  return result.toTextStreamResponse()
}

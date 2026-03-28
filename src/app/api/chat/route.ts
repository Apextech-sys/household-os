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

function extractHitlProposals(text: string): Array<{
  action_type: string
  title: string
  description: string
  proposed_action: Record<string, unknown>
}> {
  const proposals: Array<{
    action_type: string
    title: string
    description: string
    proposed_action: Record<string, unknown>
  }> = []

  // Match JSON blocks with type: "hitl_proposal"
  const jsonBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```/g
  let match
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.type === 'hitl_proposal' && parsed.action_type && parsed.title) {
        proposals.push({
          action_type: parsed.action_type,
          title: parsed.title,
          description: parsed.description ?? '',
          proposed_action: parsed.proposed_action ?? parsed,
        })
      }
    } catch {
      // Skip malformed JSON blocks
    }
  }

  return proposals
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

HUMAN-IN-THE-LOOP (HITL):
When a user requests a consequential action (filing a claim, sending a dispute, making a booking), do NOT execute it directly. Instead, propose it as a HITL action by returning a JSON block with type hitl_proposal containing action_type, title, description, and proposed_action details. The system will create an approval request for the user.

Example:
\`\`\`json
{
  "type": "hitl_proposal",
  "action_type": "warranty_claim",
  "title": "File warranty claim for Samsung TV",
  "description": "Submit warranty claim to Samsung for 55-inch QLED TV purchased on 2024-01-15",
  "proposed_action": {
    "retailer": "Samsung",
    "product": "55-inch QLED TV",
    "issue": "Screen flickering after 6 months"
  }
}
\`\`\`

POPIA / FSCA COMPLIANCE:
- You provide information only — never financial advice
- Never reveal account numbers in full
- All data is private to this household`

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages,
    maxOutputTokens: 2048,
    onFinish: async ({ text, usage }) => {
      await logAiUsage(supabase, {
        householdId: profile.household_id,
        userId: user.id,
        model: 'claude-sonnet-4-5',
        endpoint: '/api/chat',
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
      })

      // Detect HITL proposals in the response and insert into hitl_actions
      const proposals = extractHitlProposals(text)
      for (const proposal of proposals) {
        const { error } = await supabase.from('hitl_actions').insert({
          household_id: profile.household_id,
          user_id: user.id,
          action_type: proposal.action_type,
          module: 'chat',
          title: proposal.title,
          description: proposal.description,
          proposed_action: proposal.proposed_action,
          status: 'proposed',
        })
        if (error) {
          console.error('[HITL] Failed to create action:', error)
        }
      }
    },
  })

  return result.toTextStreamResponse()
}

import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { logAiUsage } from '@/lib/ai/log-usage'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) return new Response('No household', { status: 400 })

  const { data: policy } = await supabase
    .from('insurance_policies')
    .select('insurer, policy_number, policy_type, premium_amount, premium_frequency, cover_amount, start_date, renewal_date, status, benefits, exclusions, household_id')
    .eq('id', params.id)
    .eq('household_id', profile.household_id)
    .single()

  if (!policy) return new Response('Not found', { status: 404 })

  const { messages } = await request.json()

  const systemPrompt = `Answer questions about this insurance policy based on the policy data provided.

POLICY DETAILS:
- Insurer: ${policy.insurer}
- Policy Number: ${policy.policy_number}
- Policy Type: ${policy.policy_type}
- Premium: ${policy.premium_amount != null ? `R${policy.premium_amount}` : 'not specified'} ${policy.premium_frequency ? `/ ${policy.premium_frequency}` : ''}
- Cover Amount: ${policy.cover_amount != null ? `R${policy.cover_amount}` : 'not specified'}
- Start Date: ${policy.start_date ?? 'not specified'}
- Renewal Date: ${policy.renewal_date ?? 'not specified'}
- Status: ${policy.status}

BENEFITS:
${JSON.stringify(policy.benefits ?? [], null, 2)}

EXCLUSIONS:
${JSON.stringify(policy.exclusions ?? [], null, 2)}

Rules:
- Answer only from the policy data above
- If the answer is not in the policy data, say so clearly
- For amounts, always include the currency (ZAR / Rand)
- For dates, use DD Month YYYY format
- Keep answers concise and practical`

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages,
    maxOutputTokens: 1024,
    onFinish: async ({ usage }) => {
      await logAiUsage(supabase, {
        householdId: policy.household_id,
        userId: user.id,
        model: 'claude-sonnet-4-5',
        endpoint: `/api/insurance/${params.id}/qa`,
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
      })
    },
  })

  return result.toTextStreamResponse()
}

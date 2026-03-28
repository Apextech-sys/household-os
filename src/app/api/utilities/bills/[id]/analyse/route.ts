import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  // Load the bill
  const { data: bill, error: billError } = await supabase
    .from('utility_bills')
    .select('*')
    .eq('id', params.id)
    .eq('household_id', profile.household_id)
    .single()

  if (billError || !bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  // Load the account
  const { data: account } = await supabase
    .from('utility_accounts')
    .select('*')
    .eq('id', bill.account_id)
    .eq('household_id', profile.household_id)
    .single()

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Load previous bills for comparison (last 6)
  const { data: previousBills } = await supabase
    .from('utility_bills')
    .select('bill_date, total_amount, consumption, is_anomalous')
    .eq('account_id', bill.account_id)
    .eq('household_id', profile.household_id)
    .neq('id', params.id)
    .order('bill_date', { ascending: false })
    .limit(6)

  const avgPreviousAmount = previousBills && previousBills.length > 0
    ? previousBills.reduce((sum, b) => sum + Number(b.total_amount), 0) / previousBills.length
    : null

  const systemPrompt = `You are a utility bill analyst for HouseholdOS, a South African household management platform.
Your role is to analyse utility bills for anomalies, compare to historical usage, and draft formal dispute letters when warranted.

Rules:
- Be concise and factual
- Use South African English and ZAR (Rand) for currency
- If generating a dispute letter, format it as a formal business letter
- Reference specific amounts and dates
- Compare current bill to historical average where available
- Identify potential causes: meter errors, billing system errors, unusual consumption, tariff changes`

  const userPrompt = `Analyse this utility bill and determine if it is anomalous. If it is anomalous, generate a formal dispute letter.

ACCOUNT DETAILS:
- Provider: ${account.provider}
- Account Number: ${account.account_number}
- Utility Type: ${account.utility_type}
- Municipality: ${account.municipality ?? 'N/A'}
- Property Address: ${account.property_address ?? 'N/A'}

CURRENT BILL:
- Bill Date: ${bill.bill_date}
- Due Date: ${bill.due_date}
- Total Amount: R ${Number(bill.total_amount).toFixed(2)}
- Flagged as Anomalous: ${bill.is_anomalous}
- Anomaly Details: ${bill.anomaly_details ?? 'None recorded'}
- Line Items: ${JSON.stringify(bill.line_items ?? {}, null, 2)}
- Consumption: ${JSON.stringify(bill.consumption ?? {}, null, 2)}

PREVIOUS BILLS (last 6):
${previousBills && previousBills.length > 0
  ? previousBills.map(b => `  - ${b.bill_date}: R ${Number(b.total_amount).toFixed(2)}${b.consumption ? ` (consumption: ${JSON.stringify(b.consumption)})` : ''}`).join('\n')
  : '  No previous bills available'}
${avgPreviousAmount !== null ? `\nHistorical Average: R ${avgPreviousAmount.toFixed(2)}` : ''}

Please respond with a JSON object in exactly this format:
{
  "analysis": "Your detailed analysis of the bill (2-4 paragraphs)",
  "is_anomalous": true or false,
  "dispute_draft": "The full text of the formal dispute letter, or null if no dispute is needed"
}`

  let aiResult: { analysis: string; is_anomalous: boolean; dispute_draft: string | null }

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 2048,
    })

    // Parse AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI returned non-JSON response')

    const parsed = JSON.parse(jsonMatch[0])
    aiResult = {
      analysis: parsed.analysis ?? 'No analysis provided.',
      is_anomalous: parsed.is_anomalous ?? bill.is_anomalous,
      dispute_draft: parsed.dispute_draft ?? null,
    }
  } catch (err) {
    console.error('[Utilities/Analyse] AI error:', err)
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }

  // Update bill with AI anomaly determination
  if (aiResult.is_anomalous !== bill.is_anomalous) {
    await supabase
      .from('utility_bills')
      .update({ is_anomalous: aiResult.is_anomalous })
      .eq('id', params.id)
  }

  // Create HITL action if a dispute draft was generated
  let hitlAction = null
  if (aiResult.dispute_draft) {
    const { data: action, error: hitlError } = await supabase
      .from('hitl_actions')
      .insert({
        household_id: profile.household_id,
        module: 'utilities',
        title: `Dispute Letter — ${account.provider} bill ${bill.bill_date}`,
        description: `AI-generated dispute letter for anomalous ${account.utility_type} bill of R ${Number(bill.total_amount).toFixed(2)} dated ${bill.bill_date}.`,
        status: 'proposed',
        proposed_action: {
          type: 'dispute_letter',
          bill_id: params.id,
          account_id: account.id,
          provider: account.provider,
          account_number: account.account_number,
          bill_date: bill.bill_date,
          total_amount: bill.total_amount,
          dispute_draft: aiResult.dispute_draft,
        },
      })
      .select()
      .single()

    if (!hitlError) {
      hitlAction = action
    } else {
      console.error('[Utilities/Analyse] Failed to create HITL action:', hitlError)
    }
  }

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'utility_bill.analyse',
    entity_type: 'utility_bill',
    entity_id: params.id,
    details: {
      is_anomalous: aiResult.is_anomalous,
      dispute_generated: aiResult.dispute_draft !== null,
      hitl_action_id: hitlAction?.id ?? null,
    },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json({
    analysis: aiResult.analysis,
    dispute_draft: aiResult.dispute_draft,
    is_anomalous: aiResult.is_anomalous,
    hitl_action_id: hitlAction?.id ?? null,
  })
}

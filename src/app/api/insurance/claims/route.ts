import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createClaimSchema = z.object({
  policy_id: z.string().uuid(),
  claim_type: z.string().min(1, 'Claim type is required'),
  description: z.string().min(1, 'Description is required'),
  amount_claimed: z.number().positive('Amount must be greater than zero'),
})

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'No household' }, { status: 400 })

  const { data, error } = await supabase
    .from('insurance_claims')
    .select('*, insurance_policies(insurer, policy_number, policy_type)')
    .eq('household_id', profile.household_id)
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

  const body = await request.json()
  const parsed = createClaimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Verify the policy belongs to this household
  const { data: policy } = await supabase
    .from('insurance_policies')
    .select('id, household_id, insurer, policy_number')
    .eq('id', parsed.data.policy_id)
    .eq('household_id', profile.household_id)
    .single()

  if (!policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  }

  // Create the HITL action first
  const { data: hitlAction, error: hitlError } = await supabase
    .from('hitl_actions')
    .insert({
      household_id: profile.household_id,
      action_type: 'insurance_claim',
      status: 'proposed',
      proposed_by: user.id,
      payload: {
        policy_id: parsed.data.policy_id,
        claim_type: parsed.data.claim_type,
        description: parsed.data.description,
        amount_claimed: parsed.data.amount_claimed,
        insurer: policy.insurer,
        policy_number: policy.policy_number,
      },
    })
    .select()
    .single()

  if (hitlError) return NextResponse.json({ error: safeError(hitlError) }, { status: 500 })

  // Create the claim as draft
  const { data: claim, error: claimError } = await supabase
    .from('insurance_claims')
    .insert({
      household_id: profile.household_id,
      policy_id: parsed.data.policy_id,
      claim_type: parsed.data.claim_type,
      description: parsed.data.description,
      amount_claimed: parsed.data.amount_claimed,
      status: 'draft',
      hitl_action_id: hitlAction.id,
    })
    .select()
    .single()

  if (claimError) return NextResponse.json({ error: safeError(claimError) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'insurance_claim.create',
    entity_type: 'insurance_claim',
    entity_id: claim.id,
    details: {
      policy_id: parsed.data.policy_id,
      claim_type: parsed.data.claim_type,
      amount_claimed: parsed.data.amount_claimed,
      hitl_action_id: hitlAction.id,
    },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json({ claim, hitl_action: hitlAction }, { status: 201 })
}

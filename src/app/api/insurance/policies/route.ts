import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_POLICY_TYPES = ['life', 'short_term', 'vehicle', 'household', 'medical_gap', 'funeral', 'business'] as const
const VALID_STATUSES = ['active', 'lapsed', 'cancelled', 'pending_renewal'] as const

const createPolicySchema = z.object({
  document_id: z.string().uuid().optional().nullable(),
  insurer: z.string().min(1, 'Insurer is required'),
  policy_number: z.string().min(1, 'Policy number is required'),
  policy_type: z.enum(VALID_POLICY_TYPES),
  premium_amount: z.number().positive().optional().nullable(),
  premium_frequency: z.string().optional().nullable(),
  cover_amount: z.number().positive().optional().nullable(),
  start_date: z.string().optional().nullable(),
  renewal_date: z.string().optional().nullable(),
  status: z.enum(VALID_STATUSES).default('active'),
  benefits: z.any().optional().nullable(),
  exclusions: z.any().optional().nullable(),
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
    .from('insurance_policies')
    .select('*')
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
  const parsed = createPolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: policy, error } = await supabase
    .from('insurance_policies')
    .insert({
      household_id: profile.household_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })

  await logAudit(supabase, {
    household_id: profile.household_id,
    user_id: user.id,
    action: 'insurance_policy.create',
    entity_type: 'insurance_policy',
    entity_id: policy.id,
    details: {
      insurer: policy.insurer,
      policy_type: policy.policy_type,
      policy_number: policy.policy_number,
    },
    ip_address: request.headers.get('x-forwarded-for'),
  })

  return NextResponse.json(policy, { status: 201 })
}

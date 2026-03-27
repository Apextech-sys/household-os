import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const transactionSchema = z.object({
  description: z.string().min(1),
  amount: z.number(),
  category: z.string().optional(),
  transaction_date: z.string().date(),
  is_income: z.boolean(),
  source: z.enum(['manual', 'statement', 'bank_api']),
  statement_ref: z.string().optional(),
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

  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('transaction_date', { ascending: false })
    .limit(100)

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
  const parsed = transactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('budget_transactions')
    .insert({
      household_id: profile.household_id,
      source: parsed.data.source,
      description: parsed.data.description,
      amount: parsed.data.amount,
      category: parsed.data.category ?? null,
      transaction_date: parsed.data.transaction_date,
      is_income: parsed.data.is_income,
      statement_ref: parsed.data.statement_ref ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: safeError(error) }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

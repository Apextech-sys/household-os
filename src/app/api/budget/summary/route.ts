import { safeError } from '@/lib/utils/api-error'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7) + '-01'

  const { data, error } = await supabase
    .from('budget_summaries')
    .select('*')
    .eq('household_id', profile?.household_id)
    .eq('month', month)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: safeError(error) }, { status: 500 })
  }

  return NextResponse.json(data ?? { total_income: 0, total_expenses: 0, by_category: {} })
}

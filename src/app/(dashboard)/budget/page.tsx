import { createClient } from '@/lib/supabase/server'
import { BudgetSummary } from '@/components/budget/BudgetSummary'
import { TransactionList } from '@/components/budget/TransactionList'
import { CategoryBreakdown } from '@/components/budget/CategoryBreakdown'

export default async function BudgetPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [summaryResult, transactionsResult, categoriesResult] = await Promise.all([
    householdId
      ? supabase
          .from('budget_summaries')
          .select('*')
          .eq('household_id', householdId)
          .eq('month', monthStart)
          .single()
      : Promise.resolve({ data: null }),
    householdId
      ? supabase
          .from('budget_transactions')
          .select('*')
          .eq('household_id', householdId)
          .order('transaction_date', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('budget_categories')
          .select('*')
          .eq('household_id', householdId)
          .order('name')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
      <BudgetSummary summary={summaryResult.data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TransactionList
            transactions={transactionsResult.data ?? []}
            categories={categoriesResult.data ?? []}
          />
        </div>
        <CategoryBreakdown summary={summaryResult.data} />
      </div>
    </div>
  )
}

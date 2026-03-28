import { createClient } from '@/lib/supabase/server'
import { GoalTracker } from '@/components/financial/GoalTracker'
import { NetWorthChart } from '@/components/financial/NetWorthChart'
import { ScenarioModeler } from '@/components/financial/ScenarioModeler'
import { Landmark } from 'lucide-react'

export default async function FinancialPlanningPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const [{ data: goals }, { data: snapshots }] = await Promise.all([
    supabase
      .from('financial_goals')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
    supabase
      .from('net_worth_snapshots')
      .select('*')
      .eq('household_id', householdId)
      .order('snapshot_date', { ascending: false }),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Landmark className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Financial Planning</h1>
      </div>

      {/* Goals */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Financial Goals</h2>
        <GoalTracker goals={goals ?? []} />
      </section>

      {/* Net Worth */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Net Worth</h2>
        <NetWorthChart snapshots={snapshots ?? []} />
      </section>

      {/* Scenario Modeler */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Scenario Modeler</h2>
        <ScenarioModeler />
      </section>
    </div>
  )
}

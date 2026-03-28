import { createClient } from '@/lib/supabase/server'
import { ConsumptionChart } from '@/components/energy/ConsumptionChart'
import { CostTracker } from '@/components/energy/CostTracker'
import { Zap } from 'lucide-react'

export default async function EnergyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: readings } = await supabase
    .from('energy_readings')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('reading_date', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Zap className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold text-gray-900">Energy Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostTracker readings={readings ?? []} />
        <div className="lg:col-span-2">
          <ConsumptionChart readings={readings ?? []} />
        </div>
      </div>
    </div>
  )
}

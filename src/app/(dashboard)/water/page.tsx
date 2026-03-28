import { createClient } from '@/lib/supabase/server'
import { UsageChart } from '@/components/water/UsageChart'
import { LeakAlert } from '@/components/water/LeakAlert'
import { Droplets } from 'lucide-react'

export default async function WaterPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: readings } = await supabase
    .from('water_readings')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('reading_date', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Droplets className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900">Water Management</h1>
      </div>

      <LeakAlert readings={readings ?? []} />

      <UsageChart readings={readings ?? []} />
    </div>
  )
}

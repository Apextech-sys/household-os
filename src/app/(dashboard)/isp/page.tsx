import { createClient } from '@/lib/supabase/server'
import { SpeedChart } from '@/components/isp/SpeedChart'
import { SLATracker } from '@/components/isp/SLATracker'
import { Wifi } from 'lucide-react'

export default async function ISPPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const { data: connections } = await supabase
    .from('isp_connections')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  const { data: speedTests } = await supabase
    .from('speed_tests')
    .select('*')
    .eq('household_id', householdId)
    .order('tested_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Wifi className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">ISP Intelligence</h1>
      </div>

      <SLATracker connections={connections ?? []} speedTests={speedTests ?? []} />
      <SpeedChart speedTests={speedTests ?? []} />
    </div>
  )
}

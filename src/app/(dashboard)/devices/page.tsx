import { createClient } from '@/lib/supabase/server'
import { DeviceGrid } from '@/components/devices/DeviceGrid'
import { Monitor } from 'lucide-react'

export default async function DevicesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Monitor className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
      </div>

      <DeviceGrid devices={devices ?? []} />
    </div>
  )
}

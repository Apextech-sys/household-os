import { createClient } from '@/lib/supabase/server'
import { AssetGrid } from '@/components/maintenance/AssetGrid'
import { TaskBoard } from '@/components/maintenance/TaskBoard'

export default async function MaintenancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const [{ data: assets }, { data: tasks }] = await Promise.all([
    supabase
      .from('home_assets')
      .select('*')
      .eq('household_id', profile?.household_id)
      .order('name', { ascending: true }),
    supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('household_id', profile?.household_id)
      .order('scheduled_date', { ascending: true }),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Home Maintenance</h1>
      <AssetGrid assets={assets ?? []} />
      <TaskBoard tasks={tasks ?? []} />
    </div>
  )
}

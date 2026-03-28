import { createClient } from '@/lib/supabase/server'
import { SystemCard } from '@/components/security/SystemCard'
import { Shield } from 'lucide-react'

export default async function SecurityPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: systems } = await supabase
    .from('security_systems')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Security Systems</h1>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">All Systems</h2>
        {systems && systems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systems.map((system) => (
              <SystemCard key={system.id} system={system} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No security systems found.</p>
        )}
      </section>
    </div>
  )
}

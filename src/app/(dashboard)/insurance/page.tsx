import { createClient } from '@/lib/supabase/server'
import { PolicyCard } from '@/components/insurance/PolicyCard'
import { CalendarDays } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

export default async function InsurancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: policies } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  const renewalPolicies = [...(policies ?? [])]
    .filter(p => p.renewal_date)
    .sort((a, b) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime())

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Insurance</h1>
      </div>

      {/* All policies */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">All Policies</h2>
        {policies && policies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {policies.map(policy => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No insurance policies found.</p>
        )}
      </section>

      {/* Renewal Calendar */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-700">Renewal Calendar</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            {renewalPolicies.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {renewalPolicies.map(policy => {
                  const renewalDate = new Date(policy.renewal_date)
                  const daysUntil = Math.ceil(
                    (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                  const isPast = daysUntil < 0
                  const isSoon = daysUntil >= 0 && daysUntil <= 30

                  return (
                    <li key={policy.id} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{policy.insurer}</p>
                        <p className="text-sm text-gray-500">{policy.policy_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {renewalDate.toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className={`text-xs ${isPast ? 'text-red-600' : isSoon ? 'text-yellow-600' : 'text-gray-500'}`}>
                          {isPast
                            ? `${Math.abs(daysUntil)} days overdue`
                            : daysUntil === 0
                            ? 'Renews today'
                            : `${daysUntil} days`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm p-6">No upcoming renewals.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { BenefitBalanceCard } from '@/components/medical/BenefitBalanceCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { HeartPulse, CalendarDays } from 'lucide-react'
import Link from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n)
}

export default async function MedicalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: plans } = await supabase
    .from('medical_aid_plans')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  const allPlans = plans ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <HeartPulse className="h-6 w-6 text-rose-600" />
        <h1 className="text-2xl font-bold text-gray-900">Medical Aid</h1>
      </div>

      {allPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HeartPulse className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No medical aid plans found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {allPlans.map((plan) => {
            const renewalDate = plan.renewal_date ? new Date(plan.renewal_date) : null
            const daysUntilRenewal = renewalDate
              ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null
            const isRenewalSoon = daysUntilRenewal != null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30
            const isRenewalPast = daysUntilRenewal != null && daysUntilRenewal < 0

            return (
              <div key={plan.id} className="space-y-4">
                <Link href={`/medical/${plan.id}`} className="block group">
                  <Card className="hover:border-rose-300 transition-colors">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="group-hover:text-rose-600 transition-colors">
                          {plan.scheme_name} — {plan.plan_name}
                        </CardTitle>
                        <Badge variant="secondary">{plan.membership_number}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <dt className="text-gray-500">Principal Member</dt>
                          <dd className="font-medium text-gray-900 mt-0.5">{plan.principal_member}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Monthly Contribution</dt>
                          <dd className="font-medium text-gray-900 mt-0.5">
                            {plan.monthly_contribution != null ? fmt(Number(plan.monthly_contribution)) : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Dependants</dt>
                          <dd className="font-medium text-gray-900 mt-0.5">
                            {Array.isArray(plan.dependants) ? plan.dependants.length : 0}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" /> Renewal
                          </dt>
                          <dd className="font-medium mt-0.5">
                            {renewalDate ? (
                              <span className={isRenewalPast ? 'text-red-600' : isRenewalSoon ? 'text-yellow-600' : 'text-gray-900'}>
                                {renewalDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {isRenewalSoon && ` (${daysUntilRenewal}d)`}
                                {isRenewalPast && ' (overdue)'}
                              </span>
                            ) : '—'}
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </Link>

                <BenefitBalanceCard
                  savings_balance={plan.savings_balance != null ? Number(plan.savings_balance) : null}
                  day_to_day_balance={plan.day_to_day_balance != null ? Number(plan.day_to_day_balance) : null}
                  benefits={plan.benefits}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

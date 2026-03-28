import { createClient } from '@/lib/supabase/server'
import { BenefitBalanceCard } from '@/components/medical/BenefitBalanceCard'
import { ClaimsList } from '@/components/medical/ClaimsList'
import { ProviderSearch } from '@/components/medical/ProviderSearch'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { HeartPulse, CalendarDays, Users } from 'lucide-react'
import { notFound } from 'next/navigation'

function fmt(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n)
}

export default async function MedicalPlanDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const [planResult, claimsResult] = await Promise.all([
    supabase
      .from('medical_aid_plans')
      .select('*')
      .eq('id', params.id)
      .eq('household_id', profile?.household_id)
      .single(),
    supabase
      .from('medical_claims')
      .select('*')
      .eq('plan_id', params.id)
      .eq('household_id', profile?.household_id)
      .order('claim_date', { ascending: false }),
  ])

  if (!planResult.data) return notFound()

  const plan = planResult.data
  const claims = claimsResult.data ?? []

  const renewalDate = plan.renewal_date ? new Date(plan.renewal_date) : null
  const daysUntilRenewal = renewalDate
    ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const isRenewalSoon = daysUntilRenewal != null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30
  const isRenewalPast = daysUntilRenewal != null && daysUntilRenewal < 0

  const dependants: string[] = Array.isArray(plan.dependants) ? plan.dependants : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HeartPulse className="h-6 w-6 text-rose-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{plan.scheme_name}</h1>
          <p className="text-gray-500 text-sm">{plan.plan_name}</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{plan.membership_number}</Badge>
      </div>

      {/* Plan Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-gray-500">Scheme</dt>
              <dd className="font-medium text-gray-900">{plan.scheme_name}</dd>

              <dt className="text-gray-500">Plan Name</dt>
              <dd className="font-medium text-gray-900">{plan.plan_name}</dd>

              <dt className="text-gray-500">Membership No.</dt>
              <dd className="font-medium text-gray-900">{plan.membership_number}</dd>

              <dt className="text-gray-500">Principal Member</dt>
              <dd className="font-medium text-gray-900">{plan.principal_member}</dd>

              <dt className="text-gray-500">Monthly Contribution</dt>
              <dd className="font-medium text-gray-900">
                {plan.monthly_contribution != null ? fmt(Number(plan.monthly_contribution)) : '—'}
              </dd>

              <dt className="text-gray-500 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Renewal Date
              </dt>
              <dd className="font-medium">
                {renewalDate ? (
                  <span className={isRenewalPast ? 'text-red-600' : isRenewalSoon ? 'text-yellow-600' : 'text-gray-900'}>
                    {renewalDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {isRenewalSoon && ` (${daysUntilRenewal} days)`}
                    {isRenewalPast && ' (overdue)'}
                  </span>
                ) : '—'}
              </dd>
            </dl>
          </CardContent>
        </Card>

        {/* Dependants */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <CardTitle>Dependants</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {dependants.length === 0 ? (
              <p className="text-sm text-gray-500">No dependants listed.</p>
            ) : (
              <ul className="space-y-2">
                {dependants.map((dep, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-6 w-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </span>
                    <span className="text-gray-900">{typeof dep === 'string' ? dep : JSON.stringify(dep)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Benefit Balances */}
      <BenefitBalanceCard
        savings_balance={plan.savings_balance != null ? Number(plan.savings_balance) : null}
        day_to_day_balance={plan.day_to_day_balance != null ? Number(plan.day_to_day_balance) : null}
        benefits={plan.benefits}
      />

      {/* Claims */}
      <ClaimsList claims={claims} />

      {/* Provider Search */}
      {claims.length > 0 && (
        <ProviderSearch claims={claims} />
      )}
    </div>
  )
}

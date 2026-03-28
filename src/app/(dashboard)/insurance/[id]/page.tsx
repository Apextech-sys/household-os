import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ClaimWizard } from '@/components/insurance/ClaimWizard'
import { ShieldCheck, FileText, AlertCircle } from 'lucide-react'

const STATUS_VARIANT: Record<string, 'success' | 'error' | 'secondary' | 'warning' | 'default'> = {
  active: 'success',
  lapsed: 'error',
  cancelled: 'secondary',
  pending_renewal: 'warning',
}

const CLAIM_STATUS_VARIANT: Record<string, 'success' | 'error' | 'secondary' | 'warning' | 'default'> = {
  draft: 'secondary',
  submitted: 'default',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  paid: 'success',
}

function formatZAR(amount: number | null) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

export default async function InsurancePolicyPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: policy } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('id', params.id)
    .eq('household_id', profile?.household_id)
    .single()

  if (!policy) notFound()

  const { data: claims } = await supabase
    .from('insurance_claims')
    .select('*')
    .eq('policy_id', params.id)
    .order('created_at', { ascending: false })

  const benefits: string[] = Array.isArray(policy.benefits)
    ? policy.benefits
    : typeof policy.benefits === 'object' && policy.benefits
    ? Object.values(policy.benefits as Record<string, string>)
    : []

  const exclusions: string[] = Array.isArray(policy.exclusions)
    ? policy.exclusions
    : typeof policy.exclusions === 'object' && policy.exclusions
    ? Object.values(policy.exclusions as Record<string, string>)
    : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">{policy.insurer}</h1>
          </div>
          <p className="text-gray-500 text-sm">{policy.policy_number}</p>
        </div>
        <Badge variant={STATUS_VARIANT[policy.status] ?? 'default'}>
          {policy.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Policy details */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500">Policy Type</dt>
              <dd className="font-medium text-gray-900 capitalize">{policy.policy_type.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Premium</dt>
              <dd className="font-medium text-gray-900">
                {formatZAR(policy.premium_amount)}{' '}
                <span className="text-gray-500 font-normal">/ {policy.premium_frequency}</span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Cover Amount</dt>
              <dd className="font-medium text-gray-900">{formatZAR(policy.cover_amount)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Start Date</dt>
              <dd className="font-medium text-gray-900">
                {policy.start_date
                  ? new Date(policy.start_date).toLocaleDateString('en-ZA')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Renewal Date</dt>
              <dd className="font-medium text-gray-900">
                {policy.renewal_date
                  ? new Date(policy.renewal_date).toLocaleDateString('en-ZA')
                  : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Benefits & Exclusions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {benefits.length > 0 ? (
              <ul className="space-y-2">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No benefits listed.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              Exclusions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exclusions.length > 0 ? (
              <ul className="space-y-2">
                {exclusions.map((exclusion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-red-400 mt-0.5">✗</span>
                    {exclusion}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No exclusions listed.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claims History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            Claims History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {claims && claims.length > 0 ? (
            <div className="space-y-3">
              {claims.map(claim => (
                <div
                  key={claim.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">{claim.claim_type}</span>
                      <Badge variant={CLAIM_STATUS_VARIANT[claim.status] ?? 'default'}>
                        {claim.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{claim.description}</p>
                    {claim.submitted_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Submitted {new Date(claim.submitted_at).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-medium text-gray-900">{formatZAR(claim.amount_claimed)}</p>
                    {claim.amount_paid != null && (
                      <p className="text-xs text-gray-500">Paid: {formatZAR(claim.amount_paid)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No claims have been submitted for this policy.</p>
          )}
        </CardContent>
      </Card>

      {/* Claim Wizard */}
      <Card>
        <CardHeader>
          <CardTitle>Submit a New Claim</CardTitle>
        </CardHeader>
        <CardContent>
          <ClaimWizard policyId={policy.id} householdId={profile!.household_id} />
        </CardContent>
      </Card>
    </div>
  )
}

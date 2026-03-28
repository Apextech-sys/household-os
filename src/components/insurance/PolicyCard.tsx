'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ShieldCheck, Calendar } from 'lucide-react'
import { clsx } from 'clsx'

interface Policy {
  id: string
  insurer: string
  policy_type: string
  policy_number: string
  premium_amount: number | null
  premium_frequency: string | null
  cover_amount: number | null
  renewal_date: string | null
  status: string
}

const STATUS_VARIANT: Record<string, 'success' | 'error' | 'secondary' | 'warning' | 'default'> = {
  active: 'success',
  lapsed: 'error',
  cancelled: 'secondary',
  pending_renewal: 'warning',
}

const POLICY_TYPE_LABELS: Record<string, string> = {
  life: 'Life',
  short_term: 'Short-term',
  vehicle: 'Vehicle',
  household: 'Household',
  medical_gap: 'Medical Gap',
  funeral: 'Funeral',
  business: 'Business',
}

function formatZAR(amount: number | null) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

export function PolicyCard({ policy }: { policy: Policy }) {
  const renewalDate = policy.renewal_date ? new Date(policy.renewal_date) : null
  const daysUntilRenewal = renewalDate
    ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const renewalIsPast = daysUntilRenewal !== null && daysUntilRenewal < 0
  const renewalIsSoon = daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30

  return (
    <Link href={`/insurance/${policy.id}`} className="block group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 text-sm leading-tight">{policy.insurer}</p>
                <p className="text-xs text-gray-400 mt-0.5">{policy.policy_number}</p>
              </div>
            </div>
            <Badge variant={STATUS_VARIANT[policy.status] ?? 'default'}>
              {policy.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="mb-3">
            <Badge variant="secondary" className="text-xs">
              {POLICY_TYPE_LABELS[policy.policy_type] ?? policy.policy_type}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>
              <p className="text-xs text-gray-500">Premium</p>
              <p className="font-medium text-gray-900">
                {formatZAR(policy.premium_amount)}
                {policy.premium_frequency && (
                  <span className="text-xs text-gray-400 font-normal"> /{policy.premium_frequency}</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cover</p>
              <p className="font-medium text-gray-900">{formatZAR(policy.cover_amount)}</p>
            </div>
          </div>

          {renewalDate && (
            <div
              className={clsx(
                'flex items-center gap-1.5 text-xs rounded-lg px-3 py-2',
                renewalIsPast
                  ? 'bg-red-50 text-red-700'
                  : renewalIsSoon
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-gray-50 text-gray-500'
              )}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {renewalIsPast
                  ? `Renewal overdue by ${Math.abs(daysUntilRenewal!)} days`
                  : daysUntilRenewal === 0
                  ? 'Renews today'
                  : `Renews in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}`}
              </span>
              <span className="ml-auto font-medium">
                {renewalDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

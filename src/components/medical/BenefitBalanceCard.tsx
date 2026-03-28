'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { clsx } from 'clsx'

interface BenefitBalanceCardProps {
  savings_balance: number | null
  day_to_day_balance: number | null
  benefits: Record<string, unknown> | null
}

function ProgressBar({
  value,
  max,
  colorClass,
}: {
  value: number
  max: number
  colorClass: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div
        className={clsx('h-2.5 rounded-full transition-all', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n)
}

export function BenefitBalanceCard({ savings_balance, day_to_day_balance, benefits }: BenefitBalanceCardProps) {
  const savingsLimit = (benefits as any)?.savings_limit as number | undefined
  const dayToDay_limit = (benefits as any)?.day_to_day_limit as number | undefined

  const savingsPct =
    savingsLimit && savings_balance != null
      ? Math.round(((savingsLimit - savings_balance) / savingsLimit) * 100)
      : null

  const dayPct =
    dayToDay_limit && day_to_day_balance != null
      ? Math.round(((dayToDay_limit - day_to_day_balance) / dayToDay_limit) * 100)
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benefit Balances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Savings balance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Medical Savings Account</span>
            <span className="text-sm font-semibold text-gray-900">
              {savings_balance != null ? fmt(savings_balance) : '—'}
            </span>
          </div>
          {savingsLimit != null && savings_balance != null ? (
            <>
              <ProgressBar
                value={savingsLimit - savings_balance}
                max={savingsLimit}
                colorClass="bg-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {savingsPct}% used · limit {fmt(savingsLimit)}
              </p>
            </>
          ) : (
            <ProgressBar value={0} max={1} colorClass="bg-blue-500" />
          )}
        </div>

        {/* Day-to-day balance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Day-to-Day Balance</span>
            <span className="text-sm font-semibold text-gray-900">
              {day_to_day_balance != null ? fmt(day_to_day_balance) : '—'}
            </span>
          </div>
          {dayToDay_limit != null && day_to_day_balance != null ? (
            <>
              <ProgressBar
                value={dayToDay_limit - day_to_day_balance}
                max={dayToDay_limit}
                colorClass="bg-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {dayPct}% used · limit {fmt(dayToDay_limit)}
              </p>
            </>
          ) : (
            <ProgressBar value={0} max={1} colorClass="bg-emerald-500" />
          )}
        </div>

        {/* Additional benefits from jsonb */}
        {benefits && Object.keys(benefits).filter(k => !['savings_limit', 'day_to_day_limit'].includes(k)).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Other Benefits</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(benefits)
                .filter(([k]) => !['savings_limit', 'day_to_day_limit'].includes(k))
                .map(([key, val]) => (
                  <div key={key} className="contents">
                    <dt className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                    <dd className="font-medium text-gray-900 text-right">
                      {typeof val === 'number' ? fmt(val) : String(val)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

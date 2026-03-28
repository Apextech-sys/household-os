'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Shield, Calendar, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

interface SecuritySystem {
  id: string
  name: string
  system_type: string
  provider: string | null
  account_number: string | null
  monthly_cost: number | null
  currency: string
  contract_start: string | null
  contract_end: string | null
  certificate_expiry: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

const typeLabels: Record<string, string> = {
  alarm: 'Alarm',
  cctv: 'CCTV',
  electric_fence: 'Electric Fence',
  access_control: 'Access Control',
  armed_response: 'Armed Response',
  other: 'Other',
}

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  active: 'success',
  suspended: 'warning',
  expired: 'error',
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function SystemCard({ system }: { system: SecuritySystem }) {
  const certDays = system.certificate_expiry ? daysUntil(system.certificate_expiry) : null
  const certExpiringSoon = certDays !== null && certDays <= 30

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-400 shrink-0" />
            <CardTitle className="text-base leading-tight">{system.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {certExpiringSoon && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <Badge variant={statusVariant[system.status] ?? 'secondary'} className="capitalize">
              {system.status}
            </Badge>
          </div>
        </div>
        <Badge variant="secondary" className="mt-2 w-fit">
          {typeLabels[system.system_type] ?? system.system_type}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Provider */}
        {system.provider && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Provider</span>
            <span className="text-gray-900 font-medium">{system.provider}</span>
          </div>
        )}

        {/* Monthly cost */}
        {system.monthly_cost != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Monthly Cost</span>
            <span className="text-gray-900 font-medium">
              {formatCurrency(system.monthly_cost, system.currency)}
            </span>
          </div>
        )}

        {/* Contract dates */}
        {(system.contract_start || system.contract_end) && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="h-3.5 w-3.5" />
              Contract
            </span>
            <span className="text-xs text-gray-500">
              {system.contract_start
                ? new Date(system.contract_start).toLocaleDateString('en-ZA', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })
                : '—'}
              {' - '}
              {system.contract_end
                ? new Date(system.contract_end).toLocaleDateString('en-ZA', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })
                : 'Ongoing'}
            </span>
          </div>
        )}

        {/* Certificate expiry */}
        {system.certificate_expiry && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Certificate Expiry</span>
            <div className="flex items-center gap-2">
              <span className={clsx('text-xs', certExpiringSoon ? 'text-red-600' : 'text-gray-500')}>
                {new Date(system.certificate_expiry).toLocaleDateString('en-ZA', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
              {certDays !== null && (
                <Badge variant={certDays < 0 ? 'error' : certDays <= 30 ? 'warning' : 'secondary'}>
                  {certDays < 0
                    ? `${Math.abs(certDays)}d overdue`
                    : certDays === 0
                    ? 'Today'
                    : `${certDays}d`}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

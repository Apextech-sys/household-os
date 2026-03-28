'use client'

import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { ShieldCheck, ShieldOff, ShieldAlert, Clock } from 'lucide-react'
import { clsx } from 'clsx'

interface PurchaseProtection {
  id: string
  item_description: string
  purchase_date: string
  protection_expiry: string
  amount: number
  status: 'active' | 'expired' | 'claimed'
}

interface ProtectionTimelineProps {
  protections: PurchaseProtection[]
}

function daysRemaining(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function StatusBadge({ status }: { status: PurchaseProtection['status'] }) {
  if (status === 'active') return <Badge variant="success">Active</Badge>
  if (status === 'claimed') return <Badge variant="default">Claimed</Badge>
  return <Badge variant="secondary">Expired</Badge>
}

function StatusIcon({ status }: { status: PurchaseProtection['status'] }) {
  if (status === 'active') return <ShieldCheck className="w-5 h-5 text-emerald-500" />
  if (status === 'claimed') return <ShieldAlert className="w-5 h-5 text-blue-500" />
  return <ShieldOff className="w-5 h-5 text-gray-400" />
}

export function ProtectionTimeline({ protections }: ProtectionTimelineProps) {
  if (!protections.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-2">
        <ShieldOff className="w-10 h-10" />
        <p className="text-sm">No purchase protections recorded.</p>
      </div>
    )
  }

  const sorted = [...protections].sort(
    (a, b) => new Date(a.protection_expiry).getTime() - new Date(b.protection_expiry).getTime()
  )

  return (
    <div className="space-y-3">
      {sorted.map((p) => {
        const days = daysRemaining(p.protection_expiry)
        const isExpiringSoon = p.status === 'active' && days >= 0 && days <= 30

        return (
          <Card
            key={p.id}
            className={clsx(
              'transition-colors',
              isExpiringSoon && 'border-amber-300 bg-amber-50/30'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <StatusIcon status={p.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 truncate">{p.item_description}</p>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                    <div>
                      <span className="block text-gray-400">Purchased</span>
                      <span className="font-medium text-gray-700">
                        {new Date(p.purchase_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Expires</span>
                      <span className="font-medium text-gray-700">
                        {new Date(p.protection_expiry).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Amount</span>
                      <span className="font-medium text-gray-700">
                        R {Number(p.amount).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Countdown</span>
                      {p.status === 'active' ? (
                        <span
                          className={clsx(
                            'font-semibold flex items-center gap-1',
                            days < 0
                              ? 'text-red-600'
                              : isExpiringSoon
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          )}
                        >
                          <Clock className="w-3 h-3" />
                          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

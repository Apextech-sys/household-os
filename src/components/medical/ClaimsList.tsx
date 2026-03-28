'use client'

import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { VariantProps } from 'class-variance-authority'

interface MedicalClaim {
  id: string
  provider_name: string
  claim_date: string
  amount_billed: number
  amount_paid: number | null
  shortfall: number | null
  category: string | null
  status: 'pending' | 'approved' | 'partially_paid' | 'rejected'
}

const statusVariant: Record<MedicalClaim['status'], 'default' | 'success' | 'warning' | 'error' | 'secondary'> = {
  pending: 'warning',
  approved: 'success',
  partially_paid: 'default',
  rejected: 'error',
}

const statusLabel: Record<MedicalClaim['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  partially_paid: 'Partial',
  rejected: 'Rejected',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n)
}

export function ClaimsList({ claims }: { claims: MedicalClaim[] }) {
  const totalShortfall = claims.reduce((sum, c) => sum + Number(c.shortfall ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claims</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {claims.length === 0 ? (
          <p className="text-sm text-gray-500 p-6">No claims found for this plan.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Billed</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Paid</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Shortfall</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {claims.map((claim) => {
                    const shortfall = Number(claim.shortfall ?? 0)
                    return (
                      <tr key={claim.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{claim.provider_name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(claim.claim_date).toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{claim.category ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{fmt(Number(claim.amount_billed))}</td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {claim.amount_paid != null ? fmt(Number(claim.amount_paid)) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {shortfall > 0 ? (
                            <span className="font-semibold text-red-600">{fmt(shortfall)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={statusVariant[claim.status]}>
                            {statusLabel[claim.status]}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalShortfall > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-red-50">
                <span className="text-sm font-semibold text-red-700">Total Shortfall</span>
                <span className="text-sm font-bold text-red-700">{fmt(totalShortfall)}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

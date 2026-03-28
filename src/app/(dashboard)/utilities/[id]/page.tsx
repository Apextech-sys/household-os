import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BillComparison } from '@/components/utilities/BillComparison'
import { ConsumptionChart } from '@/components/utilities/ConsumptionChart'
import { DisputeDraft } from '@/components/utilities/DisputeDraft'
import { notFound } from 'next/navigation'
import { Zap, Droplets, Home, Trash2, Activity, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const UTILITY_ICONS: Record<string, React.ReactNode> = {
  electricity: <Zap className="h-5 w-5 text-yellow-500" />,
  water: <Droplets className="h-5 w-5 text-blue-500" />,
  rates: <Home className="h-5 w-5 text-green-500" />,
  refuse: <Trash2 className="h-5 w-5 text-gray-500" />,
  sewerage: <Activity className="h-5 w-5 text-orange-500" />,
  combined: <Home className="h-5 w-5 text-purple-500" />,
}

const UTILITY_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  water: 'Water',
  rates: 'Rates',
  refuse: 'Refuse',
  sewerage: 'Sewerage',
  combined: 'Combined',
}

export default async function UtilityAccountPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: account } = await supabase
    .from('utility_accounts')
    .select('*')
    .eq('id', params.id)
    .eq('household_id', profile?.household_id)
    .single()

  if (!account) return notFound()

  const { data: bills } = await supabase
    .from('utility_bills')
    .select('*')
    .eq('account_id', account.id)
    .eq('household_id', profile?.household_id)
    .order('bill_date', { ascending: false })
    .limit(24)

  const anomalousBills = (bills ?? []).filter(b => b.is_anomalous)

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/utilities" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Utilities
      </Link>

      {/* Account header */}
      <div className="flex items-center gap-3">
        {UTILITY_ICONS[account.utility_type] ?? <Activity className="h-6 w-6 text-gray-400" />}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{account.provider}</h1>
          <p className="text-sm text-gray-500">{account.municipality}</p>
        </div>
        <Badge variant="default" className="ml-auto">
          {UTILITY_LABELS[account.utility_type] ?? account.utility_type}
        </Badge>
      </div>

      {/* Account details */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Account Number</dt>
              <dd className="font-medium mt-0.5">{account.account_number}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Utility Type</dt>
              <dd className="font-medium mt-0.5">{UTILITY_LABELS[account.utility_type] ?? account.utility_type}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Municipality</dt>
              <dd className="font-medium mt-0.5">{account.municipality ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Property Address</dt>
              <dd className="font-medium mt-0.5">{account.property_address ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Charts */}
      {bills && bills.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BillComparison bills={bills} />
          <ConsumptionChart bills={bills} />
        </div>
      )}

      {/* Anomalous bills - dispute drafts */}
      {anomalousBills.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-red-700 mb-4">
            Anomalous Bills ({anomalousBills.length})
          </h2>
          <div className="space-y-4">
            {anomalousBills.map(bill => (
              <DisputeDraft key={bill.id} bill={bill} accountId={account.id} />
            ))}
          </div>
        </section>
      )}

      {/* All bills table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Bill History</h2>
        {bills && bills.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Bill Date</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Due Date</th>
                      <th className="text-right px-6 py-3 font-medium text-gray-500">Amount</th>
                      <th className="text-center px-6 py-3 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bills.map(bill => (
                      <tr key={bill.id} className={bill.is_anomalous ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4">
                          {new Date(bill.bill_date).toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          {new Date(bill.due_date).toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className={`px-6 py-4 text-right font-semibold ${bill.is_anomalous ? 'text-red-600' : 'text-gray-900'}`}>
                          R {Number(bill.total_amount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {bill.is_anomalous ? (
                            <Badge variant="error">Anomalous</Badge>
                          ) : (
                            <Badge variant="success">Normal</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-gray-500 text-sm">No bills found for this account.</p>
        )}
      </section>
    </div>
  )
}

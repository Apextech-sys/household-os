import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Zap, Droplets, Home, Trash2, Activity } from 'lucide-react'
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

export default async function UtilitiesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: accounts } = await supabase
    .from('utility_accounts')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  // Fetch recent bills for all accounts
  const { data: recentBills } = await supabase
    .from('utility_bills')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('bill_date', { ascending: false })
    .limit(50)

  // Group latest bill per account
  const latestBillByAccount: Record<string, typeof recentBills extends (infer T)[] | null ? T : never> = {}
  for (const bill of recentBills ?? []) {
    if (!latestBillByAccount[bill.account_id]) {
      latestBillByAccount[bill.account_id] = bill
    }
  }

  // Calculate total monthly spend from latest bills
  const totalMonthlySpend = Object.values(latestBillByAccount).reduce(
    (sum, bill) => sum + Number(bill?.total_amount ?? 0),
    0
  )

  const anomalousCount = (recentBills ?? []).filter(b => b.is_anomalous).length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Utilities</h1>
        {anomalousCount > 0 && (
          <Badge variant="error">{anomalousCount} anomalous bill{anomalousCount !== 1 ? 's' : ''}</Badge>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Accounts</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{accounts?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Latest Bills Total</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              R {totalMonthlySpend.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Anomalous Bills</p>
            <p className={`text-3xl font-bold mt-1 ${anomalousCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {anomalousCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account cards */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Accounts</h2>
        {accounts && accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(account => {
              const latestBill = latestBillByAccount[account.id]
              const isAnomalous = latestBill?.is_anomalous ?? false

              return (
                <Link key={account.id} href={`/utilities/${account.id}`}>
                  <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isAnomalous ? 'border-red-300' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {UTILITY_ICONS[account.utility_type] ?? <Activity className="h-5 w-5 text-gray-400" />}
                          <CardTitle className="text-base">{account.provider}</CardTitle>
                        </div>
                        <Badge variant={isAnomalous ? 'error' : 'default'}>
                          {UTILITY_LABELS[account.utility_type] ?? account.utility_type}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Account #</dt>
                          <dd className="font-medium">{account.account_number}</dd>
                        </div>
                        {account.municipality && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Municipality</dt>
                            <dd className="font-medium">{account.municipality}</dd>
                          </div>
                        )}
                        {latestBill ? (
                          <>
                            <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                              <dt className="text-gray-500">Latest Bill</dt>
                              <dd className={`font-semibold ${isAnomalous ? 'text-red-600' : 'text-gray-900'}`}>
                                R {Number(latestBill.total_amount).toFixed(2)}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Due</dt>
                              <dd className="font-medium">
                                {new Date(latestBill.due_date).toLocaleDateString('en-ZA', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </dd>
                            </div>
                          </>
                        ) : (
                          <p className="text-gray-400 text-xs pt-2">No bills yet</p>
                        )}
                      </dl>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No utility accounts found.</p>
        )}
      </section>
    </div>
  )
}

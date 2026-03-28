import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { DebitOrderList } from '@/components/banking/DebitOrderList'
import { SubscriptionTracker } from '@/components/banking/SubscriptionTracker'
import { notFound } from 'next/navigation'

const statusVariant = {
  active: 'success' as const,
  error: 'error' as const,
  pending: 'warning' as const,
  disconnected: 'secondary' as const,
}

export default async function BankConnectionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const [connectionResult, accountsResult, debitOrdersResult, subscriptionsResult] = await Promise.all([
    supabase
      .from('bank_connections')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('bank_accounts')
      .select('*')
      .eq('connection_id', params.id)
      .order('created_at', { ascending: false }),
    householdId
      ? supabase
          .from('debit_orders')
          .select('*')
          .eq('household_id', householdId)
          .order('description')
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('subscriptions_detected')
          .select('*')
          .eq('household_id', householdId)
          .order('name')
      : Promise.resolve({ data: [] }),
  ])

  if (!connectionResult.data) return notFound()

  const connection = connectionResult.data
  const accounts = accountsResult.data ?? []
  const debitOrders = debitOrdersResult.data ?? []
  const subscriptions = subscriptionsResult.data ?? []

  const totalBalance = accounts.reduce((sum: number, acc: any) => sum + Number(acc.balance ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{connection.bank_name}</h1>
        <Badge variant={statusVariant[connection.status as keyof typeof statusVariant]}>
          {connection.status}
        </Badge>
        <Badge variant="secondary">{connection.connection_type}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Bank</dt>
              <dd className="font-medium">{connection.bank_name}</dd>
              <dt className="text-gray-500">Bank Code</dt>
              <dd className="uppercase">{connection.bank_code}</dd>
              <dt className="text-gray-500">Type</dt>
              <dd className="capitalize">{connection.connection_type.replace('_', ' ')}</dd>
              <dt className="text-gray-500">Status</dt>
              <dd className="capitalize">{connection.status}</dd>
              <dt className="text-gray-500">Last Synced</dt>
              <dd>
                {connection.last_synced_at
                  ? new Date(connection.last_synced_at).toLocaleString()
                  : 'Never'}
              </dd>
              <dt className="text-gray-500">Connected</dt>
              <dd>{new Date(connection.created_at).toLocaleDateString()}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(totalBalance)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {accounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Accounts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account: any) => (
              <Card key={account.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{account.nickname ?? account.account_number_masked}</p>
                      <p className="text-sm text-gray-500 capitalize">{account.account_type}</p>
                      {account.account_number_masked && account.nickname && (
                        <p className="text-xs text-gray-400 mt-0.5">{account.account_number_masked}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(account.balance ?? 0))}
                      </p>
                      {account.balance_updated_at && (
                        <p className="text-xs text-gray-400">
                          Updated {new Date(account.balance_updated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Debit Orders</h2>
        <DebitOrderList debitOrders={debitOrders} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Detected Subscriptions</h2>
        <SubscriptionTracker subscriptions={subscriptions} />
      </div>
    </div>
  )
}

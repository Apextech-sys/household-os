import { createClient } from '@/lib/supabase/server'
import { BankConnectionCard } from '@/components/banking/BankConnectionCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Landmark } from 'lucide-react'

export default async function BankingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const [connectionsResult, accountsResult] = await Promise.all([
    householdId
      ? supabase
          .from('bank_connections')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('bank_accounts')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const connections = connectionsResult.data ?? []
  const accounts = accountsResult.data ?? []

  const totalBalance = accounts.reduce((sum: number, acc: any) => sum + Number(acc.balance ?? 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Banking</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 font-medium">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(totalBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 font-medium">Connected Banks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{connections.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 font-medium">Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bank Connections</h2>
        {connections.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Landmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No bank connections yet</p>
            <p className="text-sm mt-1">Connect a bank account to start tracking your finances.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((connection: any) => (
              <BankConnectionCard key={connection.id} connection={connection} />
            ))}
          </div>
        )}
      </div>

      {accounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Overview</h2>
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
    </div>
  )
}

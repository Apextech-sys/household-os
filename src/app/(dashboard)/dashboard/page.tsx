import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Link from 'next/link'
import { FileText, Receipt, Inbox, Wallet } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch user profile to get household_id
  const { data: profile } = await supabase
    .from('users')
    .select('household_id, full_name')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  // Parallel fetches for dashboard data
  const [docsResult, receiptsResult, notificationsResult, hitlResult] = await Promise.all([
    householdId
      ? supabase
          .from('documents')
          .select('id, filename, status, created_at')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('receipts')
          .select('id, retailer, total_amount, currency, created_at')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('notifications')
          .select('id, title, body, type, is_read, created_at')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('hitl_actions')
          .select('id, title, module, status, created_at')
          .eq('household_id', householdId)
          .eq('status', 'proposed')
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
      </h1>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/documents" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
          <FileText className="h-8 w-8 text-blue-600" />
          <span className="text-sm font-medium">Documents</span>
        </Link>
        <Link href="/receipts" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
          <Receipt className="h-8 w-8 text-green-600" />
          <span className="text-sm font-medium">Receipts</span>
        </Link>
        <Link href="/inbox" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
          <Inbox className="h-8 w-8 text-purple-600" />
          <span className="text-sm font-medium">Inbox</span>
        </Link>
        <Link href="/budget" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
          <Wallet className="h-8 w-8 text-orange-600" />
          <span className="text-sm font-medium">Budget</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {docsResult.data?.length ? (
              <ul className="space-y-2">
                {docsResult.data.map((doc: any) => (
                  <li key={doc.id}>
                    <Link href={`/documents/${doc.id}`} className="flex items-center justify-between text-sm hover:bg-gray-50 p-2 rounded-lg">
                      <span className="truncate">{doc.filename}</span>
                      <span className="text-xs text-gray-500">{doc.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No documents yet. Upload your first document.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Receipts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            {receiptsResult.data?.length ? (
              <ul className="space-y-2">
                {receiptsResult.data.map((r: any) => (
                  <li key={r.id}>
                    <Link href={`/receipts/${r.id}`} className="flex items-center justify-between text-sm hover:bg-gray-50 p-2 rounded-lg">
                      <span className="truncate">{r.retailer ?? 'Unknown'}</span>
                      <span className="font-medium">{r.currency} {r.total_amount ?? '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No receipts yet. Upload your first receipt.</p>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notificationsResult.data?.length ? (
              <ul className="space-y-2">
                {notificationsResult.data.map((n: any) => (
                  <li key={n.id} className="text-sm p-2 bg-blue-50 rounded-lg">
                    <p className="font-medium">{n.title}</p>
                    {n.body && <p className="text-gray-600 text-xs mt-1">{n.body}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No new notifications.</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {hitlResult.data?.length ? (
              <ul className="space-y-2">
                {hitlResult.data.map((a: any) => (
                  <li key={a.id} className="text-sm p-2 bg-yellow-50 rounded-lg">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-gray-600 text-xs mt-1">{a.module}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No pending actions.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

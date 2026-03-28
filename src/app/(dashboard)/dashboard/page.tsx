import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Link from 'next/link'
import {
  FileText, Receipt, Inbox, Wallet, Landmark, Shield,
  CreditCard, Zap, Car, HeartPulse, Wrench, AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id, full_name')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [
    docsResult, receiptsResult, notificationsResult, hitlResult,
    renewalsResult, debitAnomaliesResult, vehicleAlertsResult,
    overdueTasksResult, medicalResult,
  ] = await Promise.all([
    householdId
      ? supabase.from('documents').select('id, filename, status, created_at')
          .eq('household_id', householdId).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase.from('receipts').select('id, retailer, total_amount, currency, created_at')
          .eq('household_id', householdId).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase.from('notifications').select('id, title, body, type, is_read, created_at')
          .eq('user_id', user.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase.from('hitl_actions').select('id, title, module, status, created_at')
          .eq('household_id', householdId).eq('status', 'proposed').order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    // Insurance renewals in next 30 days
    householdId
      ? supabase.from('insurance_policies').select('id, insurer, policy_type, renewal_date')
          .eq('household_id', householdId).eq('status', 'active')
          .gte('renewal_date', today).lte('renewal_date', thirtyDaysOut)
          .order('renewal_date').limit(5)
      : Promise.resolve({ data: [] }),
    // Anomalous debit orders
    householdId
      ? supabase.from('debit_orders').select('id, description, amount, anomaly_reason')
          .eq('household_id', householdId).eq('is_anomalous', true).limit(5)
      : Promise.resolve({ data: [] }),
    // Vehicle alerts (licence expiry within 30 days)
    householdId
      ? supabase.from('vehicles').select('id, make, model, licence_expiry, next_service_date')
          .eq('household_id', householdId)
          .lte('licence_expiry', thirtyDaysOut)
          .order('licence_expiry').limit(5)
      : Promise.resolve({ data: [] }),
    // Overdue maintenance tasks
    householdId
      ? supabase.from('maintenance_tasks').select('id, title, priority, scheduled_date')
          .eq('household_id', householdId).in('status', ['pending', 'scheduled'])
          .lte('scheduled_date', today).order('scheduled_date').limit(5)
      : Promise.resolve({ data: [] }),
    // Medical aid balance
    householdId
      ? supabase.from('medical_aid_plans').select('id, scheme_name, plan_name, savings_balance, day_to_day_balance')
          .eq('household_id', householdId).limit(3)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
      </h1>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { href: '/documents', label: 'Documents', icon: FileText, color: 'text-blue-600' },
          { href: '/receipts', label: 'Receipts', icon: Receipt, color: 'text-green-600' },
          { href: '/inbox', label: 'Inbox', icon: Inbox, color: 'text-purple-600' },
          { href: '/budget', label: 'Budget', icon: Wallet, color: 'text-orange-600' },
          { href: '/banking', label: 'Banking', icon: Landmark, color: 'text-cyan-600' },
          { href: '/insurance', label: 'Insurance', icon: Shield, color: 'text-indigo-600' },
          { href: '/credit-cards', label: 'Cards', icon: CreditCard, color: 'text-pink-600' },
          { href: '/utilities', label: 'Utilities', icon: Zap, color: 'text-yellow-600' },
          { href: '/vehicles', label: 'Vehicles', icon: Car, color: 'text-red-600' },
          { href: '/medical', label: 'Medical', icon: HeartPulse, color: 'text-rose-600' },
          { href: '/maintenance', label: 'Maintenance', icon: Wrench, color: 'text-gray-600' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
            <item.icon className={`h-6 w-6 ${item.color}`} />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Alerts Section */}
      {((debitAnomaliesResult.data?.length ?? 0) > 0 ||
        (vehicleAlertsResult.data?.length ?? 0) > 0 ||
        (overdueTasksResult.data?.length ?? 0) > 0 ||
        (renewalsResult.data?.length ?? 0) > 0) && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {renewalsResult.data?.map((p: any) => (
                <li key={p.id}>
                  <Link href={`/insurance/${p.id}`} className="hover:underline">
                    Insurance renewal: <strong>{p.insurer}</strong> ({p.policy_type}) due {p.renewal_date}
                  </Link>
                </li>
              ))}
              {debitAnomaliesResult.data?.map((d: any) => (
                <li key={d.id} className="text-red-700">
                  Anomalous debit order: <strong>{d.description}</strong> — R{Number(d.amount).toFixed(2)} ({d.anomaly_reason})
                </li>
              ))}
              {vehicleAlertsResult.data?.map((v: any) => (
                <li key={v.id}>
                  <Link href={`/vehicles/${v.id}`} className="hover:underline">
                    Vehicle: <strong>{v.make} {v.model}</strong> — licence expires {v.licence_expiry}
                  </Link>
                </li>
              ))}
              {overdueTasksResult.data?.map((t: any) => (
                <li key={t.id}>
                  <Link href="/maintenance" className="hover:underline">
                    Overdue task: <strong>{t.title}</strong> (due {t.scheduled_date})
                    <Badge variant="error" className="ml-2">{t.priority}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <Card>
          <CardHeader><CardTitle>Recent Documents</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>Recent Receipts</CardTitle></CardHeader>
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

        {/* Medical Aid Balances */}
        <Card>
          <CardHeader><CardTitle>Medical Aid</CardTitle></CardHeader>
          <CardContent>
            {medicalResult.data?.length ? (
              <ul className="space-y-3">
                {medicalResult.data.map((plan: any) => (
                  <li key={plan.id}>
                    <Link href={`/medical/${plan.id}`} className="block text-sm hover:bg-gray-50 p-2 rounded-lg">
                      <p className="font-medium">{plan.scheme_name} — {plan.plan_name}</p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-600">
                        {plan.savings_balance != null && <span>Savings: R{Number(plan.savings_balance).toFixed(2)}</span>}
                        {plan.day_to_day_balance != null && <span>Day-to-day: R{Number(plan.day_to_day_balance).toFixed(2)}</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No medical aid plans added yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>Pending Actions</CardTitle></CardHeader>
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

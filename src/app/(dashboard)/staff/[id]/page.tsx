import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PayslipGenerator } from '@/components/staff/PayslipGenerator'
import { User, Calendar, Shield, Banknote } from 'lucide-react'

function formatZAR(amount: number | null) {
  if (amount == null) return '--'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'error',
}

const ROLE_LABELS: Record<string, string> = {
  domestic_worker: 'Domestic Worker',
  gardener: 'Gardener',
  nanny: 'Nanny',
  driver: 'Driver',
  other: 'Other',
}

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: employee } = await supabase
    .from('domestic_employees')
    .select('*')
    .eq('id', params.id)
    .eq('household_id', profile?.household_id)
    .single()

  if (!employee) notFound()

  const { data: payslips } = await supabase
    .from('payslips')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  // All active employees for the payslip generator dropdown
  const { data: allEmployees } = await supabase
    .from('domestic_employees')
    .select('id, full_name, salary_amount')
    .eq('household_id', profile?.household_id)
    .eq('status', 'active')

  const leaveRemaining = employee.leave_days_annual - employee.leave_days_used
  const leavePercent = employee.leave_days_annual > 0
    ? Math.round((employee.leave_days_used / employee.leave_days_annual) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <User className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">{employee.full_name}</h1>
          </div>
          <p className="text-gray-500 text-sm">{ROLE_LABELS[employee.role] ?? employee.role}</p>
        </div>
        <Badge variant={STATUS_VARIANT[employee.status] ?? 'secondary'} className="capitalize shrink-0">
          {employee.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Employee Details */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Start Date
              </dt>
              <dd className="font-medium text-gray-900">{formatDate(employee.start_date)}</dd>
            </div>
            {employee.end_date && (
              <div>
                <dt className="text-gray-500">End Date</dt>
                <dd className="font-medium text-gray-900">{formatDate(employee.end_date)}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" /> Salary
              </dt>
              <dd className="font-medium text-gray-900">
                {formatZAR(employee.salary_amount)}
                {employee.salary_frequency && (
                  <span className="text-gray-400 ml-1 text-xs">/ {employee.salary_frequency}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> UIF Status
              </dt>
              <dd className="flex items-center gap-2">
                <Badge variant={employee.uif_registered ? 'success' : 'warning'}>
                  {employee.uif_registered ? 'Registered' : 'Not Registered'}
                </Badge>
                {employee.uif_reference && (
                  <span className="text-xs text-gray-500 font-mono">{employee.uif_reference}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Leave Balance</dt>
              <dd className="font-medium text-gray-900">
                {leaveRemaining} of {employee.leave_days_annual} days remaining
              </dd>
            </div>
          </dl>

          {/* Leave progress bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  leavePercent >= 90 ? 'bg-red-500' :
                  leavePercent >= 70 ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${Math.min(leavePercent, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payslips */}
      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips && payslips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Period</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Basic Salary</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">UIF</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Other</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Net Pay</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map(slip => (
                    <tr key={slip.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 px-3 text-gray-700">
                        {formatDate(slip.period_start)} — {formatDate(slip.period_end)}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-900">{formatZAR(slip.basic_salary)}</td>
                      <td className="py-2 px-3 text-right text-red-600">-{formatZAR(slip.uif_deduction)}</td>
                      <td className="py-2 px-3 text-right text-red-600">-{formatZAR(slip.other_deductions)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-green-700">{formatZAR(slip.net_pay)}</td>
                      <td className="py-2 px-3 text-right text-xs text-gray-500">{formatDate(slip.generated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No payslips generated yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Payslip Generator */}
      <PayslipGenerator
        employees={allEmployees ?? []}
        currentEmployeeId={employee.id}
      />
    </div>
  )
}

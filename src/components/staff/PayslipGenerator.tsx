'use client'

import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileText } from 'lucide-react'

interface Employee {
  id: string
  full_name: string
  salary_amount: number | null
}

function formatZAR(amount: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

export function PayslipGenerator({ employees, currentEmployeeId }: { employees: Employee[]; currentEmployeeId?: string }) {
  const [employeeId, setEmployeeId] = useState(currentEmployeeId ?? '')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [otherDeductions, setOtherDeductions] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedEmployee = employees.find(e => e.id === employeeId)
  const basicSalary = selectedEmployee?.salary_amount ?? 0

  const uifDeduction = useMemo(() => {
    return Math.round(basicSalary * 0.01 * 100) / 100
  }, [basicSalary])

  const netPay = useMemo(() => {
    return basicSalary - uifDeduction - otherDeductions
  }, [basicSalary, uifDeduction, otherDeductions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/staff/payslips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          period_start: periodStart,
          period_end: periodEnd,
          basic_salary: basicSalary,
          uif_deduction: uifDeduction,
          other_deductions: otherDeductions,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate payslip')
      }

      setSuccess(true)
      setPeriodStart('')
      setPeriodEnd('')
      setOtherDeductions(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          Generate Payslip
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>

          {/* Period dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Salary breakdown */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Basic Salary</span>
              <span className="font-medium text-gray-900">{formatZAR(basicSalary)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">UIF Deduction (1%)</span>
              <span className="font-medium text-red-600">-{formatZAR(uifDeduction)}</span>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Other Deductions</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(Number(e.target.value))}
              />
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
              <span className="font-semibold text-gray-900">Net Pay</span>
              <span className="font-bold text-green-700">{formatZAR(netPay)}</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">Payslip generated successfully.</p>
          )}

          <Button type="submit" disabled={submitting || !employeeId || !periodStart || !periodEnd}>
            {submitting ? 'Generating...' : 'Generate Payslip'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

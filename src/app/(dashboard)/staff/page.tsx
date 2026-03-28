import { createClient } from '@/lib/supabase/server'
import { EmployeeCard } from '@/components/staff/EmployeeCard'
import { LeaveTracker } from '@/components/staff/LeaveTracker'
import { Users } from 'lucide-react'

export default async function StaffPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: employees } = await supabase
    .from('domestic_employees')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  const activeEmployees = (employees ?? []).filter(e => e.status !== 'terminated')

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
      </div>

      {/* Leave Tracker */}
      {activeEmployees.length > 0 && (
        <LeaveTracker employees={activeEmployees} />
      )}

      {/* Employee Grid */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">All Employees</h2>
        {employees && employees.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map(employee => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No employees found.</p>
        )}
      </section>
    </div>
  )
}

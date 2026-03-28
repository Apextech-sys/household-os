'use client'

import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { ClipboardList } from 'lucide-react'

interface MaintenanceTask {
  id: string
  title: string
  description?: string | null
  priority: string
  status: string
  scheduled_date?: string | null
  contractor_name?: string | null
  contractor_phone?: string | null
  estimated_cost?: number | null
}

const COLUMNS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'complete', label: 'Complete' },
]

const priorityVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'secondary'> = {
  urgent: 'error',
  high: 'warning',
  medium: 'warning',
  low: 'secondary',
}

const priorityLabelClass: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
}

export function TaskBoard({ tasks }: { tasks: MaintenanceTask[] }) {
  const byStatus = COLUMNS.reduce<Record<string, MaintenanceTask[]>>((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key)
    return acc
  }, {})

  const totalActive = tasks.filter((t) => t.status !== 'complete' && t.status !== 'cancelled').length

  if (!tasks.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No maintenance tasks yet.</p>
        <p className="text-sm mt-1">Open an asset to schedule a maintenance task.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Task Board</h2>
        {totalActive > 0 && (
          <span className="text-sm text-gray-500">{totalActive} active task{totalActive !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-medium text-gray-700">{col.label}</span>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {byStatus[col.key].length}
              </span>
            </div>

            <div className="flex flex-col gap-3 min-h-[120px] bg-gray-50 rounded-xl p-3">
              {byStatus[col.key].length === 0 && (
                <p className="text-xs text-gray-400 text-center pt-6">No tasks</p>
              )}
              {byStatus[col.key].map((task) => (
                <Card key={task.id} className="shadow-none">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-sm font-medium text-gray-900 leading-snug mb-2">
                      {task.title}
                    </p>

                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-2 ${
                        priorityLabelClass[task.priority] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {task.priority}
                    </span>

                    <div className="space-y-1 text-xs text-gray-500">
                      {task.scheduled_date && (
                        <p>
                          {new Date(task.scheduled_date).toLocaleDateString()}
                        </p>
                      )}
                      {task.contractor_name && (
                        <p className="truncate">{task.contractor_name}</p>
                      )}
                      {task.estimated_cost != null && (
                        <p>Est. R {Number(task.estimated_cost).toFixed(2)}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

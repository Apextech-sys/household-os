'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface ServiceSchedulerProps {
  assetId: string
  householdId: string
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export function ServiceScheduler({ assetId, householdId }: ServiceSchedulerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as typeof PRIORITIES[number],
    scheduled_date: '',
    contractor_name: '',
    contractor_phone: '',
    estimated_cost: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const body: Record<string, unknown> = {
        asset_id: assetId,
        household_id: householdId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: 'pending',
        scheduled_date: form.scheduled_date || null,
        contractor_name: form.contractor_name.trim() || null,
        contractor_phone: form.contractor_phone.trim() || null,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      }

      const res = await fetch('/api/maintenance/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create task.')
        return
      }

      setSuccess(true)
      setForm({
        title: '',
        description: '',
        priority: 'medium',
        scheduled_date: '',
        contractor_name: '',
        contractor_phone: '',
        estimated_cost: '',
      })
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule a Task</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Annual geyser service"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Optional details..."
                className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
              <Input
                type="date"
                name="scheduled_date"
                value={form.scheduled_date}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Name</label>
              <Input
                name="contractor_name"
                value={form.contractor_name}
                onChange={handleChange}
                placeholder="e.g. Joe Plumbing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Phone</label>
              <Input
                name="contractor_phone"
                value={form.contractor_phone}
                onChange={handleChange}
                placeholder="+27 11 000 0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost (R)</label>
              <Input
                type="number"
                name="estimated_cost"
                value={form.estimated_cost}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              Task created successfully.
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Schedule Task'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

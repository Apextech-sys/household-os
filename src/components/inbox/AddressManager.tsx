'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Plus, Trash2 } from 'lucide-react'

export function AddressManager({ addresses }: { addresses: any[] }) {
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/inbox/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() }),
      })
      if (res.ok) {
        setLabel('')
        router.refresh()
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <h2 className="text-sm font-medium text-gray-900">Inbox Addresses</h2>

      {addresses.length > 0 && (
        <div className="space-y-2">
          {addresses.map((addr) => (
            <div key={addr.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
              <div>
                <span className="font-medium">{addr.label ?? 'Unlabelled'}</span>
                <span className="text-gray-500 ml-2">{addr.email_address}</span>
              </div>
              <Badge variant={addr.is_active ? 'success' : 'secondary'}>
                {addr.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Address label (e.g. Bank Statements)"
          className="flex-1"
        />
        <Button type="submit" disabled={creating || !label.trim()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </form>
    </div>
  )
}

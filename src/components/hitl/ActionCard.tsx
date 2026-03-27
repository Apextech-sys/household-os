'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Check, X } from 'lucide-react'
import type { HitlAction } from '@/types'

export function ActionCard({ action, onUpdate }: { action: HitlAction; onUpdate?: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleAction(decision: 'approve' | 'reject') {
    setLoading(true)
    try {
      await fetch('/api/hitl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id, decision }),
      })
      onUpdate?.()
    } finally {
      setLoading(false)
    }
  }

  const statusVariant = {
    proposed: 'warning' as const,
    approved: 'success' as const,
    rejected: 'secondary' as const,
    executed: 'success' as const,
    failed: 'error' as const,
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-medium text-gray-900">{action.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{action.module}</p>
          </div>
          <Badge variant={statusVariant[action.status]}>{action.status}</Badge>
        </div>

        {action.description && (
          <p className="text-sm text-gray-600 mb-3">{action.description}</p>
        )}

        {action.proposed_action && (
          <pre className="text-xs bg-gray-50 p-3 rounded-lg mb-3 overflow-auto max-h-32">
            {JSON.stringify(action.proposed_action, null, 2)}
          </pre>
        )}

        {action.status === 'proposed' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleAction('approve')}
              disabled={loading}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('reject')}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { ActionCard } from '@/components/hitl/ActionCard'
import { useRouter } from 'next/navigation'
import type { HitlAction } from '@/types'

export function ActionList({ actions }: { actions: HitlAction[] }) {
  const router = useRouter()

  if (!actions.length) {
    return <p className="text-sm text-gray-500 text-center py-8">No pending actions.</p>
  }

  return (
    <div className="space-y-4">
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} onUpdate={() => router.refresh()} />
      ))}
    </div>
  )
}

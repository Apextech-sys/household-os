'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Mail } from 'lucide-react'

const statusVariant = {
  received: 'secondary' as const,
  processing: 'warning' as const,
  parsed: 'success' as const,
  error: 'error' as const,
}

export function InboxList({ messages }: { messages: any[] }) {
  if (!messages.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No messages yet</p>
        <p className="text-sm mt-1">Forward emails to your inbox address to get started.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {messages.map((msg) => (
        <Link
          key={msg.id}
          href={`/inbox/${msg.id}`}
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">{msg.subject ?? '(No subject)'}</p>
              <Badge variant={statusVariant[msg.status as keyof typeof statusVariant]}>{msg.status}</Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              From: {msg.from_email} &middot; {new Date(msg.received_at).toLocaleDateString()}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}

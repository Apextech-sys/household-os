'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Landmark, AlertCircle, Clock } from 'lucide-react'
import { clsx } from 'clsx'

interface BankConnection {
  id: string
  bank_name: string
  bank_code: string
  connection_type: string
  status: string
  last_synced_at: string | null
  created_at: string
}

const statusVariant: Record<string, 'success' | 'error' | 'warning' | 'secondary'> = {
  active: 'success',
  error: 'error',
  pending: 'warning',
  disconnected: 'secondary',
}

export function BankConnectionCard({ connection }: { connection: BankConnection }) {
  const variant = statusVariant[connection.status] ?? 'secondary'

  return (
    <Link href={`/banking/${connection.id}`} className="block group">
      <Card className="hover:border-blue-300 transition-colors h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              <CardTitle className="text-base">{connection.bank_name}</CardTitle>
            </div>
            {connection.status === 'error' && (
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant={variant}>{connection.status}</Badge>
            <Badge variant="secondary">{connection.connection_type.replace('_', ' ')}</Badge>
          </div>
          <div className={clsx('flex items-center gap-1.5 text-xs text-gray-500')}>
            <Clock className="h-3.5 w-3.5" />
            {connection.last_synced_at ? (
              <span>Synced {new Date(connection.last_synced_at).toLocaleString()}</span>
            ) : (
              <span>Never synced</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

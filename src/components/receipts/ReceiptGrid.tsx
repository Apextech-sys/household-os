'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Receipt as ReceiptIcon } from 'lucide-react'
import type { Receipt } from '@/types'

const statusVariant = {
  uploading: 'secondary' as const,
  processing: 'warning' as const,
  ready: 'success' as const,
  error: 'error' as const,
}

export function ReceiptGrid({ receipts }: { receipts: Receipt[] }) {
  if (!receipts.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ReceiptIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No receipts yet</p>
        <p className="text-sm mt-1">Upload or photograph a receipt to get started.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {receipts.map((receipt) => (
        <Link
          key={receipt.id}
          href={`/receipts/${receipt.id}`}
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900 truncate">{receipt.retailer ?? 'Unknown'}</span>
            <Badge variant={statusVariant[receipt.status]}>{receipt.status}</Badge>
          </div>
          <div className="text-sm text-gray-600">
            {receipt.purchase_date && (
              <p>{new Date(receipt.purchase_date).toLocaleDateString()}</p>
            )}
            {receipt.total_amount && (
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {receipt.currency} {Number(receipt.total_amount).toFixed(2)}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

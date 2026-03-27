'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { FileText } from 'lucide-react'
import type { Document } from '@/types'

const statusVariant = {
  uploading: 'secondary' as const,
  processing: 'warning' as const,
  ready: 'success' as const,
  error: 'error' as const,
}

export function DocumentList({ documents }: { documents: Document[] }) {
  if (!documents.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No documents uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {documents.map((doc) => (
        <Link
          key={doc.id}
          href={`/documents/${doc.id}`}
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
              <p className="text-xs text-gray-500">
                {(doc.file_size / 1024).toFixed(1)} KB &middot; {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant={statusVariant[doc.status]}>{doc.status}</Badge>
        </Link>
      ))}
    </div>
  )
}

'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FileText, Users, Calendar } from 'lucide-react'

interface LegalDocument {
  id: string
  title: string
  document_type: string
  parties: string[]
  effective_date: string | null
  expiry_date: string | null
  summary: string | null
  analysis_status: string
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const TYPE_LABELS: Record<string, string> = {
  lease: 'Lease',
  contract: 'Contract',
  agreement: 'Agreement',
  policy: 'Policy',
  notice: 'Notice',
  other: 'Other',
}

export function DocumentSummary({ document }: { document: LegalDocument }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            {document.title}
          </CardTitle>
          <Badge variant="secondary" className="capitalize shrink-0">
            {TYPE_LABELS[document.document_type] ?? document.document_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {document.summary ? (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Summary</h4>
            <p className="text-sm text-gray-600 leading-relaxed">{document.summary}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No summary available yet.</p>
        )}

        {/* Parties */}
        {document.parties && document.parties.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Parties
            </h4>
            <ul className="space-y-1">
              {document.parties.map((party, idx) => (
                <li key={idx} className="text-sm text-gray-600">{party}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Dates */}
        <div className="flex flex-wrap gap-4">
          {document.effective_date && (
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-500">Effective:</span>
              <span className="font-medium text-gray-900">{formatDate(document.effective_date)}</span>
            </div>
          )}
          {document.expiry_date && (
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-500">Expires:</span>
              <span className="font-medium text-gray-900">{formatDate(document.expiry_date)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

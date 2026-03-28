import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Scale, FileText, AlertTriangle } from 'lucide-react'

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'secondary'> = {
  pending: 'secondary',
  analysing: 'warning',
  complete: 'success',
  error: 'error',
}

const TYPE_LABELS: Record<string, string> = {
  lease: 'Lease',
  contract: 'Contract',
  agreement: 'Agreement',
  policy: 'Policy',
  notice: 'Notice',
  other: 'Other',
}

export default async function LegalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: documents } = await supabase
    .from('legal_documents')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Scale className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Legal Advisor</h1>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Documents</h2>
        {documents && documents.length > 0 ? (
          <div className="space-y-4">
            {documents.map(doc => {
              const redFlagCount = Array.isArray(doc.red_flags) ? doc.red_flags.length : 0

              return (
                <Card key={doc.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                          <h3 className="font-medium text-gray-900 truncate">{doc.title}</h3>
                          <Badge variant="secondary" className="capitalize shrink-0">
                            {TYPE_LABELS[doc.document_type] ?? doc.document_type}
                          </Badge>
                        </div>

                        {/* Summary */}
                        {doc.summary && (
                          <p className="text-sm text-gray-600 mt-1 ml-6 line-clamp-2">
                            {doc.summary}
                          </p>
                        )}

                        {/* Dates & parties */}
                        <div className="flex flex-wrap gap-3 mt-2 ml-6 text-xs text-gray-500">
                          {doc.effective_date && (
                            <span>Effective: {formatDate(doc.effective_date)}</span>
                          )}
                          {doc.expiry_date && (
                            <span>Expires: {formatDate(doc.expiry_date)}</span>
                          )}
                          {Array.isArray(doc.parties) && doc.parties.length > 0 && (
                            <span>Parties: {doc.parties.join(', ')}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Red flag count */}
                        {redFlagCount > 0 && (
                          <Badge variant="error" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {redFlagCount}
                          </Badge>
                        )}

                        {/* Analysis status */}
                        <Badge variant={STATUS_VARIANT[doc.analysis_status] ?? 'secondary'} className="capitalize">
                          {doc.analysis_status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No legal documents found.</p>
        )}
      </section>
    </div>
  )
}

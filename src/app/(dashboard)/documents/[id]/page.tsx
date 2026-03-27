import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { DocumentChat } from '@/components/documents/DocumentChat'
import { notFound } from 'next/navigation'

export default async function DocumentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!doc) return notFound()

  const statusVariant = {
    uploading: 'secondary' as const,
    processing: 'warning' as const,
    ready: 'success' as const,
    error: 'error' as const,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{doc.filename}</h1>
        <Badge variant={statusVariant[doc.status as keyof typeof statusVariant]}>{doc.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500">Type</dt>
                <dd>{doc.mime_type}</dd>
                <dt className="text-gray-500">Size</dt>
                <dd>{(doc.file_size / 1024).toFixed(1)} KB</dd>
                <dt className="text-gray-500">Uploaded</dt>
                <dd>{new Date(doc.created_at).toLocaleDateString()}</dd>
              </dl>
            </CardContent>
          </Card>

          {doc.extracted_data && (
            <Card>
              <CardHeader>
                <CardTitle>Extracted Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
                  {JSON.stringify(doc.extracted_data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {doc.ocr_text && (
            <Card>
              <CardHeader>
                <CardTitle>OCR Text</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-auto">
                  {doc.ocr_text}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {doc.status === 'ready' && <DocumentChat documentId={doc.id} />}
        </div>
      </div>
    </div>
  )
}

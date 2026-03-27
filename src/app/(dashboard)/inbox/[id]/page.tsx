import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { notFound } from 'next/navigation'

export default async function InboxMessagePage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: message } = await supabase
    .from('inbox_messages')
    .select('*, inbox_addresses(label, email_address)')
    .eq('id', params.id)
    .single()

  if (!message) return notFound()

  const { data: attachments } = await supabase
    .from('inbox_attachments')
    .select('*')
    .eq('message_id', params.id)

  const statusVariant = {
    received: 'secondary' as const,
    processing: 'warning' as const,
    parsed: 'success' as const,
    error: 'error' as const,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{message.subject ?? '(No subject)'}</h1>
        <Badge variant={statusVariant[message.status as keyof typeof statusVariant]}>{message.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">From</dt>
            <dd>{message.from_email}</dd>
            <dt className="text-gray-500">To</dt>
            <dd>{(message as any).inbox_addresses?.email_address}</dd>
            <dt className="text-gray-500">Received</dt>
            <dd>{new Date(message.received_at).toLocaleString()}</dd>
          </dl>
        </CardContent>
      </Card>

      {message.body && (
        <Card>
          <CardHeader>
            <CardTitle>Body</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-auto">
              {message.body}
            </div>
          </CardContent>
        </Card>
      )}

      {message.parsed_data && (
        <Card>
          <CardHeader>
            <CardTitle>Parsed Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(message.parsed_data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {attachments && attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {attachments.map((att: any) => (
                <li key={att.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                  <span>{att.filename}</span>
                  <span className="text-gray-500">{att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { WarrantyCard } from '@/components/receipts/WarrantyCard'
import { notFound } from 'next/navigation'

export default async function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: receipt } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!receipt) return notFound()

  const { data: warranties } = await supabase
    .from('warranties')
    .select('*')
    .eq('receipt_id', params.id)

  const statusVariant = {
    uploading: 'secondary' as const,
    processing: 'warning' as const,
    ready: 'success' as const,
    error: 'error' as const,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{receipt.retailer ?? 'Receipt'}</h1>
        <Badge variant={statusVariant[receipt.status as keyof typeof statusVariant]}>{receipt.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receipt Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Retailer</dt>
              <dd>{receipt.retailer ?? '—'}</dd>
              <dt className="text-gray-500">Date</dt>
              <dd>{receipt.purchase_date ? new Date(receipt.purchase_date).toLocaleDateString() : '—'}</dd>
              <dt className="text-gray-500">Total</dt>
              <dd>{receipt.currency} {receipt.total_amount ?? '—'}</dd>
            </dl>
          </CardContent>
        </Card>

        {receipt.items && Array.isArray(receipt.items) && (
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(receipt.items as any[]).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <span>{item.name}</span>
                    <span className="font-medium">{receipt.currency} {item.price?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {warranties && warranties.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Warranties</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warranties.map((w: any) => (
              <WarrantyCard key={w.id} warranty={w} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

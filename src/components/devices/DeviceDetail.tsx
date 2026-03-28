'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

interface Device {
  id: string
  name: string
  device_type: string
  brand: string | null
  model: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_price: number | null
  currency: string | null
  status: string
  warranty_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  active: 'success',
  storage: 'secondary',
  repair: 'warning',
  retired: 'error',
}

export function DeviceDetail({ device }: { device: Device }) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Name', value: device.name },
    { label: 'Type', value: <span className="capitalize">{device.device_type}</span> },
    { label: 'Status', value: <Badge variant={STATUS_VARIANT[device.status] ?? 'secondary'} className="capitalize">{device.status}</Badge> },
    { label: 'Brand', value: device.brand ?? '-' },
    { label: 'Model', value: device.model ?? '-' },
    { label: 'Serial Number', value: device.serial_number ? <span className="font-mono">{device.serial_number}</span> : '-' },
    {
      label: 'Purchase Date',
      value: device.purchase_date
        ? new Date(device.purchase_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-',
    },
    {
      label: 'Purchase Price',
      value: device.purchase_price != null
        ? `${device.currency ?? 'ZAR'} ${device.purchase_price.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
        : '-',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{device.name}</CardTitle>
          <Badge variant={STATUS_VARIANT[device.status] ?? 'secondary'} className="capitalize">
            {device.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-sm font-medium text-gray-500">{label}</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>

        {device.warranty_id && (
          <div className="pt-2 border-t border-gray-100">
            <Link
              href={`/warranties?id=${device.warranty_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View linked warranty
            </Link>
          </div>
        )}

        {device.notes && (
          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{device.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
          <p>Created: {new Date(device.created_at).toLocaleString('en-ZA')}</p>
          <p>Updated: {new Date(device.updated_at).toLocaleString('en-ZA')}</p>
        </div>
      </CardContent>
    </Card>
  )
}

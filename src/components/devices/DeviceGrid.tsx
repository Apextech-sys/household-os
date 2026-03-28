'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Smartphone, Laptop, Tablet, Tv, Refrigerator, Wifi, Package } from 'lucide-react'

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
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  phone: 'Phones',
  laptop: 'Laptops',
  tablet: 'Tablets',
  tv: 'TVs',
  appliance: 'Appliances',
  iot: 'IoT Devices',
  other: 'Other',
}

const DEVICE_TYPE_ICONS: Record<string, React.ReactNode> = {
  phone: <Smartphone className="h-4 w-4" />,
  laptop: <Laptop className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  tv: <Tv className="h-4 w-4" />,
  appliance: <Refrigerator className="h-4 w-4" />,
  iot: <Wifi className="h-4 w-4" />,
  other: <Package className="h-4 w-4" />,
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  active: 'success',
  storage: 'secondary',
  repair: 'warning',
  retired: 'error',
}

export function DeviceGrid({ devices }: { devices: Device[] }) {
  const grouped = devices.reduce<Record<string, Device[]>>((acc, device) => {
    const type = device.device_type || 'other'
    if (!acc[type]) acc[type] = []
    acc[type].push(device)
    return acc
  }, {})

  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const order = ['phone', 'laptop', 'tablet', 'tv', 'appliance', 'iot', 'other']
    return order.indexOf(a) - order.indexOf(b)
  })

  if (devices.length === 0) {
    return <p className="text-gray-500 text-sm">No devices found.</p>
  }

  return (
    <div className="space-y-8">
      {sortedTypes.map(type => (
        <section key={type}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-500">{DEVICE_TYPE_ICONS[type] ?? DEVICE_TYPE_ICONS.other}</span>
            <h2 className="text-lg font-semibold text-gray-700">
              {DEVICE_TYPE_LABELS[type] ?? type}
            </h2>
            <span className="text-sm text-gray-400">({grouped[type].length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped[type].map(device => (
              <Card key={device.id} className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{device.name}</CardTitle>
                    <Badge variant={STATUS_VARIANT[device.status] ?? 'secondary'} className="capitalize shrink-0">
                      {device.status}
                    </Badge>
                  </div>
                  {(device.brand || device.model) && (
                    <p className="text-sm text-gray-500 mt-1">
                      {[device.brand, device.model].filter(Boolean).join(' ')}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {device.serial_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Serial</span>
                      <span className="font-mono text-gray-700 text-xs">{device.serial_number}</span>
                    </div>
                  )}
                  {device.purchase_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Purchased</span>
                      <span className="text-gray-700">
                        {new Date(device.purchase_date).toLocaleDateString('en-ZA', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {device.purchase_price != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Price</span>
                      <span className="text-gray-700">
                        {device.currency ?? 'ZAR'} {device.purchase_price.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {device.warranty_id && (
                    <div className="pt-1">
                      <Badge variant="default">Warranty linked</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

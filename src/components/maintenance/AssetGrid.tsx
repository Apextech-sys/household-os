'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Wrench, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

interface HomeAsset {
  id: string
  name: string
  category: string
  brand?: string | null
  model?: string | null
  last_service_date?: string | null
  next_service_date?: string | null
}

const categoryVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'secondary'> = {
  appliance: 'default',
  plumbing: 'default',
  electrical: 'warning',
  hvac: 'default',
  structural: 'secondary',
  garden: 'success',
  pool: 'default',
  security: 'warning',
  solar: 'success',
  geyser: 'default',
  other: 'secondary',
}

export function AssetGrid({ assets }: { assets: HomeAsset[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!assets.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Wrench className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No assets registered yet.</p>
        <p className="text-sm mt-1">Add your home assets to start tracking maintenance.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Assets</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => {
          const nextService = asset.next_service_date ? new Date(asset.next_service_date) : null
          const isOverdue = nextService !== null && nextService < today

          return (
            <Link key={asset.id} href={`/maintenance/${asset.id}`}>
              <Card className="hover:border-blue-300 transition-colors h-full">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="font-semibold text-gray-900 truncate">{asset.name}</span>
                    <Badge variant={categoryVariant[asset.category] ?? 'secondary'}>
                      {asset.category}
                    </Badge>
                  </div>

                  {(asset.brand || asset.model) && (
                    <p className="text-sm text-gray-500 mb-3 truncate">
                      {[asset.brand, asset.model].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <div className="space-y-1 text-xs">
                    {asset.last_service_date && (
                      <div className="flex items-center justify-between text-gray-500">
                        <span>Last service</span>
                        <span>{new Date(asset.last_service_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {nextService && (
                      <div
                        className={clsx(
                          'flex items-center justify-between',
                          isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
                        )}
                      >
                        <span className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle className="h-3 w-3" />}
                          Next service
                        </span>
                        <span>{nextService.toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

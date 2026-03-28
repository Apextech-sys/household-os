'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Car, Calendar, Gauge, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number | null
  registration: string | null
  licence_expiry: string | null
  next_service_date: string | null
  next_service_km: number | null
  current_km: number | null
  finance_type: string | null
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const licenceDays = vehicle.licence_expiry ? daysUntil(vehicle.licence_expiry) : null
  const serviceDays = vehicle.next_service_date ? daysUntil(vehicle.next_service_date) : null

  const licenceVariant =
    licenceDays === null ? 'secondary' :
    licenceDays < 0 ? 'error' :
    licenceDays <= 30 ? 'error' :
    licenceDays <= 60 ? 'warning' :
    'success'

  const serviceVariant =
    serviceDays === null ? 'secondary' :
    serviceDays < 0 ? 'error' :
    serviceDays <= 14 ? 'warning' :
    'success'

  const kmOverdue =
    vehicle.next_service_km != null &&
    vehicle.current_km != null &&
    vehicle.current_km >= vehicle.next_service_km

  return (
    <Link href={`/vehicles/${vehicle.id}`} className="block group">
      <Card className="hover:border-blue-300 transition-colors h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
              <CardTitle className="text-base leading-tight">
                {vehicle.make} {vehicle.model}
                {vehicle.year && (
                  <span className="text-gray-400 font-normal ml-1">({vehicle.year})</span>
                )}
              </CardTitle>
            </div>
            {(kmOverdue || licenceDays !== null && licenceDays <= 30) && (
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            )}
          </div>
          {vehicle.registration && (
            <p className="text-sm text-gray-500 mt-1 font-mono uppercase">{vehicle.registration}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Licence expiry */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="h-3.5 w-3.5" />
              Licence expiry
            </span>
            {vehicle.licence_expiry ? (
              <div className="flex items-center gap-2">
                <span className={clsx('text-xs', licenceDays !== null && licenceDays <= 0 ? 'text-red-600' : 'text-gray-500')}>
                  {new Date(vehicle.licence_expiry).toLocaleDateString('en-ZA', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
                {licenceDays !== null && (
                  <Badge variant={licenceVariant}>
                    {licenceDays < 0
                      ? `${Math.abs(licenceDays)}d overdue`
                      : licenceDays === 0
                      ? 'Today'
                      : `${licenceDays}d`}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-400">—</span>
            )}
          </div>

          {/* Next service */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <Gauge className="h-3.5 w-3.5" />
              Next service
            </span>
            <div className="flex items-center gap-2">
              {vehicle.next_service_date ? (
                <>
                  <span className="text-xs text-gray-500">
                    {new Date(vehicle.next_service_date).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                  {serviceDays !== null && (
                    <Badge variant={serviceVariant}>
                      {serviceDays < 0
                        ? `${Math.abs(serviceDays)}d overdue`
                        : serviceDays === 0
                        ? 'Today'
                        : `${serviceDays}d`}
                    </Badge>
                  )}
                </>
              ) : vehicle.next_service_km != null ? (
                <Badge variant={kmOverdue ? 'error' : 'secondary'}>
                  {vehicle.next_service_km.toLocaleString()} km
                  {kmOverdue && ' (overdue)'}
                </Badge>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </div>
          </div>

          {/* Finance type */}
          {vehicle.finance_type && (
            <div className="pt-1">
              <Badge variant="secondary" className="capitalize">{vehicle.finance_type}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

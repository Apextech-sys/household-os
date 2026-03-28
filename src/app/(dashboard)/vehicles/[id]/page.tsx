import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ServiceTimeline } from '@/components/vehicles/ServiceTimeline'
import { FineManager } from '@/components/vehicles/FineManager'
import { Car, Calendar, Gauge, CreditCard } from 'lucide-react'

function formatZAR(amount: number | null) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const FINANCE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'secondary'> = {
  owned: 'success',
  financed: 'default',
  leased: 'warning',
  balloon: 'warning',
}

export default async function VehicleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', params.id)
    .eq('household_id', profile?.household_id)
    .single()

  if (!vehicle) notFound()

  const { data: events } = await supabase
    .from('vehicle_events')
    .select('*')
    .eq('vehicle_id', vehicle.id)
    .eq('household_id', profile?.household_id)
    .order('event_date', { ascending: false })

  const allEvents = events ?? []
  const fines = allEvents.filter(e => e.event_type === 'fine')

  const licenceDays = vehicle.licence_expiry
    ? Math.ceil((new Date(vehicle.licence_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Car className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              {vehicle.make} {vehicle.model}
              {vehicle.year && (
                <span className="text-gray-400 font-normal ml-2 text-xl">({vehicle.year})</span>
              )}
            </h1>
          </div>
          {vehicle.registration && (
            <p className="text-gray-500 font-mono uppercase text-sm">{vehicle.registration}</p>
          )}
        </div>
        {vehicle.finance_type && (
          <Badge variant={FINANCE_VARIANT[vehicle.finance_type] ?? 'secondary'} className="capitalize shrink-0">
            {vehicle.finance_type}
          </Badge>
        )}
      </div>

      {/* Vehicle details */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {vehicle.vin && (
              <div className="sm:col-span-2 lg:col-span-1">
                <dt className="text-gray-500">VIN</dt>
                <dd className="font-medium text-gray-900 font-mono text-xs">{vehicle.vin}</dd>
              </div>
            )}
            {vehicle.current_km != null && (
              <div>
                <dt className="text-gray-500 flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" /> Current KM
                </dt>
                <dd className="font-medium text-gray-900">{vehicle.current_km.toLocaleString()} km</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Licence Expiry
              </dt>
              <dd className="font-medium text-gray-900 flex items-center gap-2">
                {formatDate(vehicle.licence_expiry)}
                {licenceDays !== null && (
                  <Badge variant={licenceDays <= 0 ? 'error' : licenceDays <= 30 ? 'error' : licenceDays <= 60 ? 'warning' : 'success'}>
                    {licenceDays < 0
                      ? `${Math.abs(licenceDays)}d overdue`
                      : licenceDays === 0
                      ? 'Today'
                      : `${licenceDays}d`}
                  </Badge>
                )}
              </dd>
            </div>
            {vehicle.next_service_date && (
              <div>
                <dt className="text-gray-500">Next Service Date</dt>
                <dd className="font-medium text-gray-900">{formatDate(vehicle.next_service_date)}</dd>
              </div>
            )}
            {vehicle.next_service_km != null && (
              <div>
                <dt className="text-gray-500">Next Service KM</dt>
                <dd className="font-medium text-gray-900">{vehicle.next_service_km.toLocaleString()} km</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Finance info */}
      {(vehicle.finance_type === 'financed' || vehicle.finance_type === 'leased' || vehicle.finance_type === 'balloon') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              Finance Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-gray-500">Finance Type</dt>
                <dd className="font-medium text-gray-900 capitalize">{vehicle.finance_type}</dd>
              </div>
              {vehicle.balloon_amount != null && (
                <div>
                  <dt className="text-gray-500">Balloon Amount</dt>
                  <dd className="font-medium text-gray-900">{formatZAR(vehicle.balloon_amount)}</dd>
                </div>
              )}
              {vehicle.balloon_date && (
                <div>
                  <dt className="text-gray-500">Balloon Date</dt>
                  <dd className="font-medium text-gray-900">{formatDate(vehicle.balloon_date)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Service timeline */}
      <ServiceTimeline events={allEvents} />

      {/* Fine manager */}
      <FineManager fines={fines} />
    </div>
  )
}

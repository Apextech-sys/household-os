import { createClient } from '@/lib/supabase/server'
import { VehicleCard } from '@/components/vehicles/VehicleCard'
import { AlertTriangle, Car } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'

export default async function VehiclesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  const now = Date.now()

  const expiringLicences = (vehicles ?? []).filter(v => {
    if (!v.licence_expiry) return false
    const days = Math.ceil((new Date(v.licence_expiry).getTime() - now) / (1000 * 60 * 60 * 24))
    return days <= 30
  })

  const overdueServices = (vehicles ?? []).filter(v => {
    const dateOverdue = v.next_service_date
      ? new Date(v.next_service_date).getTime() < now
      : false
    const kmOverdue =
      v.next_service_km != null &&
      v.current_km != null &&
      v.current_km >= v.next_service_km
    return dateOverdue || kmOverdue
  })

  const hasAlerts = expiringLicences.length > 0 || overdueServices.length > 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
        </div>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-700">Alerts</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {expiringLicences.map(v => {
                  const days = Math.ceil(
                    (new Date(v.licence_expiry).getTime() - now) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <li key={`lic-${v.id}`} className="flex items-center gap-3 px-6 py-3 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span className="font-medium text-gray-900">
                        {v.make} {v.model}
                      </span>
                      <span className="text-red-600">
                        {days < 0
                          ? `Licence expired ${Math.abs(days)} days ago`
                          : days === 0
                          ? 'Licence expires today'
                          : `Licence expires in ${days} days`}
                      </span>
                    </li>
                  )
                })}
                {overdueServices.map(v => (
                  <li key={`svc-${v.id}`} className="flex items-center gap-3 px-6 py-3 text-sm">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                    <span className="font-medium text-gray-900">
                      {v.make} {v.model}
                    </span>
                    <span className="text-yellow-700">Service overdue</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Vehicle list */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">All Vehicles</h2>
        {vehicles && vehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No vehicles found.</p>
        )}
      </section>
    </div>
  )
}

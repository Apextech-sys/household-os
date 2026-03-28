import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ServiceScheduler } from '@/components/maintenance/ServiceScheduler'
import { notFound } from 'next/navigation'

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

const priorityVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'secondary'> = {
  urgent: 'error',
  high: 'warning',
  medium: 'warning',
  low: 'secondary',
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'secondary'> = {
  pending: 'secondary',
  scheduled: 'default',
  in_progress: 'warning',
  complete: 'success',
  cancelled: 'error',
}

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const [{ data: asset }, { data: tasks }] = await Promise.all([
    supabase
      .from('home_assets')
      .select('*')
      .eq('id', params.id)
      .eq('household_id', profile?.household_id)
      .single(),
    supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('asset_id', params.id)
      .order('scheduled_date', { ascending: false }),
  ])

  if (!asset) return notFound()

  const { data: warrantyData } = asset.warranty_id
    ? await supabase.from('warranties').select('*').eq('id', asset.warranty_id).maybeSingle()
    : { data: null }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
        <Badge variant={categoryVariant[asset.category] ?? 'secondary'}>
          {asset.category}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Asset Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-gray-500">Brand</dt>
              <dd className="font-medium">{asset.brand ?? '—'}</dd>
              <dt className="text-gray-500">Model</dt>
              <dd className="font-medium">{asset.model ?? '—'}</dd>
              <dt className="text-gray-500">Category</dt>
              <dd className="font-medium capitalize">{asset.category}</dd>
              <dt className="text-gray-500">Purchase Date</dt>
              <dd className="font-medium">
                {asset.purchase_date
                  ? new Date(asset.purchase_date).toLocaleDateString()
                  : '—'}
              </dd>
              <dt className="text-gray-500">Expected Lifespan</dt>
              <dd className="font-medium">
                {asset.expected_lifespan_years ? `${asset.expected_lifespan_years} years` : '—'}
              </dd>
              <dt className="text-gray-500">Last Service</dt>
              <dd className="font-medium">
                {asset.last_service_date
                  ? new Date(asset.last_service_date).toLocaleDateString()
                  : '—'}
              </dd>
              <dt className="text-gray-500">Next Service</dt>
              <dd className={`font-medium ${
                asset.next_service_date && new Date(asset.next_service_date) < today
                  ? 'text-red-600'
                  : 'text-gray-900'
              }`}>
                {asset.next_service_date
                  ? new Date(asset.next_service_date).toLocaleDateString()
                  : '—'}
              </dd>
            </dl>
          </CardContent>
        </Card>

        {warrantyData && (
          <Card>
            <CardHeader>
              <CardTitle>Warranty</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-gray-500">Provider</dt>
                <dd className="font-medium">{(warrantyData as any).provider ?? '—'}</dd>
                <dt className="text-gray-500">Expires</dt>
                <dd className="font-medium">
                  {(warrantyData as any).expiry_date
                    ? new Date((warrantyData as any).expiry_date).toLocaleDateString()
                    : '—'}
                </dd>
              </dl>
            </CardContent>
          </Card>
        )}
      </div>

      {asset.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{asset.notes}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule Maintenance</h2>
        <ServiceScheduler assetId={asset.id} householdId={profile?.household_id ?? ''} />
      </div>

      {tasks && tasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Task History</h2>
          <div className="space-y-3">
            {tasks.map((task: any) => (
              <Card key={task.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {task.scheduled_date && (
                          <span>Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}</span>
                        )}
                        {task.completed_date && (
                          <span>Completed: {new Date(task.completed_date).toLocaleDateString()}</span>
                        )}
                        {task.contractor_name && <span>Contractor: {task.contractor_name}</span>}
                        {task.actual_cost != null && (
                          <span>Cost: R {Number(task.actual_cost).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={priorityVariant[task.priority] ?? 'secondary'}>
                        {task.priority}
                      </Badge>
                      <Badge variant={statusVariant[task.status] ?? 'secondary'}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

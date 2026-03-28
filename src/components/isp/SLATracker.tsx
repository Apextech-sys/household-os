'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'

interface ISPConnection {
  id: string
  provider: string
  package_name: string
  contracted_speed_mbps: number
  monthly_cost: number | null
  contract_end_date: string | null
  status: string
  created_at: string
}

interface SpeedTest {
  id: string
  connection_id: string
  download_mbps: number
  upload_mbps: number
  latency_ms: number
  tested_at: string
}

export function SLATracker({
  connections,
  speedTests,
}: {
  connections: ISPConnection[]
  speedTests: SpeedTest[]
}) {
  const connectionStats = connections.map((conn) => {
    const tests = speedTests.filter((t) => t.connection_id === conn.id)
    const avgDown =
      tests.length > 0
        ? tests.reduce((sum, t) => sum + t.download_mbps, 0) / tests.length
        : null
    const avgUp =
      tests.length > 0
        ? tests.reduce((sum, t) => sum + t.upload_mbps, 0) / tests.length
        : null
    const avgLatency =
      tests.length > 0
        ? tests.reduce((sum, t) => sum + t.latency_ms, 0) / tests.length
        : null
    const compliance =
      avgDown != null && conn.contracted_speed_mbps > 0
        ? Math.min((avgDown / conn.contracted_speed_mbps) * 100, 100)
        : null

    return { conn, tests, avgDown, avgUp, avgLatency, compliance }
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5" />
        SLA Compliance
      </h2>

      {connectionStats.length === 0 ? (
        <p className="text-gray-500 text-sm">No ISP connections configured.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connectionStats.map(({ conn, tests, avgDown, avgUp, avgLatency, compliance }) => (
            <Card key={conn.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {conn.provider} - {conn.package_name}
                  </CardTitle>
                  <Badge
                    variant={conn.status === 'active' ? 'success' : 'error'}
                  >
                    {conn.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Contracted Speed</span>
                    <p className="font-mono font-medium">{conn.contracted_speed_mbps} Mbps</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg. Download</span>
                    <p className="font-mono font-medium">
                      {avgDown != null ? `${avgDown.toFixed(1)} Mbps` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg. Upload</span>
                    <p className="font-mono font-medium">
                      {avgUp != null ? `${avgUp.toFixed(1)} Mbps` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg. Latency</span>
                    <p className="font-mono font-medium">
                      {avgLatency != null ? `${avgLatency.toFixed(0)} ms` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Compliance bar */}
                {compliance != null && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-500">SLA Compliance</span>
                      <span
                        className={clsx(
                          'font-semibold',
                          compliance >= 90
                            ? 'text-green-600'
                            : compliance >= 70
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        )}
                      >
                        {compliance.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full',
                          compliance >= 90
                            ? 'bg-green-500'
                            : compliance >= 70
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        )}
                        style={{ width: `${compliance}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{tests.length} speed test{tests.length !== 1 ? 's' : ''} recorded</span>
                  {conn.monthly_cost != null && (
                    <span>R{conn.monthly_cost.toFixed(2)}/mo</span>
                  )}
                </div>

                {conn.contract_end_date && (
                  <div className="text-xs text-gray-500">
                    Contract ends: {new Date(conn.contract_end_date).toLocaleDateString('en-ZA')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

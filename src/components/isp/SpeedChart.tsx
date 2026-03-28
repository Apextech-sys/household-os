'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Activity } from 'lucide-react'
import { clsx } from 'clsx'

interface SpeedTest {
  id: string
  connection_id: string
  download_mbps: number
  upload_mbps: number
  latency_ms: number
  tested_at: string
  created_at: string
}

export function SpeedChart({ speedTests }: { speedTests: SpeedTest[] }) {
  const sorted = [...speedTests].sort(
    (a, b) => new Date(b.tested_at).getTime() - new Date(a.tested_at).getTime()
  )

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
        <Activity className="h-5 w-5" />
        Speed Test History
      </h2>

      {sorted.length === 0 ? (
        <p className="text-gray-500 text-sm">No speed tests recorded yet.</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Download (Mbps)</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Upload (Mbps)</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Latency (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((test) => (
                  <tr key={test.id}>
                    <td className="px-6 py-3 text-gray-700">
                      {new Date(test.tested_at).toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                      {test.download_mbps.toFixed(1)}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                      {test.upload_mbps.toFixed(1)}
                    </td>
                    <td className={clsx(
                      'px-6 py-3 text-right font-mono',
                      test.latency_ms > 50 ? 'text-red-600' : 'text-green-600'
                    )}>
                      {test.latency_ms.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Simple visual bar chart */}
      {sorted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Download Speed Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sorted.slice(0, 10).reverse().map((test) => {
                const max = Math.max(...sorted.map((t) => t.download_mbps))
                const pct = max > 0 ? (test.download_mbps / max) * 100 : 0

                return (
                  <div key={test.id} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-gray-500 shrink-0">
                      {new Date(test.tested_at).toLocaleDateString('en-ZA', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-gray-700">
                      {test.download_mbps.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

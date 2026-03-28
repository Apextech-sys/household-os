'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

interface RedFlag {
  severity: 'high' | 'medium' | 'low'
  description: string
  clause?: string
}

const SEVERITY_VARIANT: Record<string, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
}

const SEVERITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function RedFlagList({ redFlags }: { redFlags: RedFlag[] }) {
  if (!redFlags || redFlags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gray-400" />
            Red Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No red flags identified.</p>
        </CardContent>
      </Card>
    )
  }

  const sorted = [...redFlags].sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
  )

  const grouped: Record<string, RedFlag[]> = {}
  for (const flag of sorted) {
    const key = flag.severity
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(flag)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          Red Flags
          <Badge variant="error">{redFlags.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(['high', 'medium', 'low'] as const).map(severity => {
            const flags = grouped[severity]
            if (!flags || flags.length === 0) return null

            return (
              <div key={severity}>
                <h4 className={clsx(
                  'text-xs font-semibold uppercase tracking-wider mb-2',
                  severity === 'high' ? 'text-red-600' :
                  severity === 'medium' ? 'text-yellow-600' :
                  'text-blue-600'
                )}>
                  {severity} severity
                </h4>
                <ul className="space-y-2">
                  {flags.map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className={clsx(
                        'h-4 w-4 shrink-0 mt-0.5',
                        severity === 'high' ? 'text-red-500' :
                        severity === 'medium' ? 'text-yellow-500' :
                        'text-blue-500'
                      )} />
                      <div>
                        <p className="text-gray-900">{flag.description}</p>
                        {flag.clause && (
                          <p className="text-xs text-gray-500 mt-0.5">Clause: {flag.clause}</p>
                        )}
                      </div>
                      <Badge variant={SEVERITY_VARIANT[severity]} className="shrink-0 ml-auto">
                        {severity}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

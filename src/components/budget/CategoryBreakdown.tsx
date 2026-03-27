import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

interface SummaryData {
  by_category: Record<string, number> | null
}

export function CategoryBreakdown({ summary }: { summary: SummaryData | null }) {
  const categories = summary?.by_category ?? {}
  const entries = Object.entries(categories).sort(([, a], [, b]) => b - a)
  const total = entries.reduce((sum, [, val]) => sum + val, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>By Category</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No category data yet.</p>
        ) : (
          <div className="space-y-3">
            {entries.map(([cat, val]) => {
              const pct = total > 0 ? (val / total) * 100 : 0
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{cat}</span>
                    <span className="font-medium">R {val.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 bg-blue-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

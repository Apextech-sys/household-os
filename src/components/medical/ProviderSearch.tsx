'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

interface MedicalClaim {
  id: string
  provider_name: string
  amount_billed: number
}

interface ProviderSummary {
  provider_name: string
  claim_count: number
  total_billed: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n)
}

export function ProviderSearch({ claims }: { claims: MedicalClaim[] }) {
  const [query, setQuery] = useState('')

  const providers = useMemo<ProviderSummary[]>(() => {
    const map = new Map<string, ProviderSummary>()
    for (const claim of claims) {
      const existing = map.get(claim.provider_name)
      if (existing) {
        existing.claim_count += 1
        existing.total_billed += Number(claim.amount_billed)
      } else {
        map.set(claim.provider_name, {
          provider_name: claim.provider_name,
          claim_count: 1,
          total_billed: Number(claim.amount_billed),
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total_billed - a.total_billed)
  }, [claims])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return providers
    return providers.filter((p) => p.provider_name.toLowerCase().includes(q))
  }, [providers, query])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search providers..."
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No providers match your search.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((provider) => (
              <li key={provider.provider_name} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{provider.provider_name}</p>
                  <p className="text-xs text-gray-500">
                    {provider.claim_count} claim{provider.claim_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{fmt(provider.total_billed)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

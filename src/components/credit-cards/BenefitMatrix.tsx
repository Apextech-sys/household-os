'use client'

import { clsx } from 'clsx'

interface CreditCard {
  id: string
  card_name: string
  card_type: string
  purchase_protection_days: number | null
  warranty_extension_months: number | null
  travel_insurance: Record<string, unknown> | null
  annual_fee: number | null
}

interface BenefitMatrixProps {
  cards: CreditCard[]
}

type BenefitRow = {
  label: string
  key: keyof CreditCard
  format: (value: unknown) => string
  best: (values: (number | null)[]) => number | null
  higher?: boolean
}

const rows: BenefitRow[] = [
  {
    label: 'Purchase Protection (days)',
    key: 'purchase_protection_days',
    format: (v) => v != null ? `${v} days` : '—',
    best: (vals) => {
      const nums = vals.filter((v): v is number => v != null)
      return nums.length ? Math.max(...nums) : null
    },
    higher: true,
  },
  {
    label: 'Warranty Extension (months)',
    key: 'warranty_extension_months',
    format: (v) => v != null ? `+${v} mo` : '—',
    best: (vals) => {
      const nums = vals.filter((v): v is number => v != null)
      return nums.length ? Math.max(...nums) : null
    },
    higher: true,
  },
  {
    label: 'Travel Insurance',
    key: 'travel_insurance',
    format: (v) => v != null && typeof v === 'object' && Object.keys(v as object).length > 0 ? 'Included' : '—',
    best: (_vals) => null,
    higher: true,
  },
  {
    label: 'Annual Fee',
    key: 'annual_fee',
    format: (v) => v != null ? `R ${Number(v).toFixed(2)}` : 'Free',
    best: (vals) => {
      const nums = vals.filter((v): v is number => v != null)
      return nums.length ? Math.min(...nums) : null
    },
    higher: false,
  },
]

export function BenefitMatrix({ cards }: BenefitMatrixProps) {
  if (!cards.length) {
    return <p className="text-sm text-gray-500">No cards to compare.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-semibold text-gray-700 w-48">Benefit</th>
            {cards.map((card) => (
              <th key={card.id} className="text-center px-4 py-3 font-semibold text-gray-700">
                <div>{card.card_name}</div>
                <div className="text-xs font-normal text-gray-500">{card.card_type}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const rawValues = cards.map((c) => c[row.key] as number | null)
            const bestVal = row.key !== 'travel_insurance' ? row.best(rawValues) : null

            return (
              <tr
                key={row.label}
                className={clsx('border-b border-gray-100 last:border-0', rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}
              >
                <td className="px-4 py-3 font-medium text-gray-700">{row.label}</td>
                {cards.map((card) => {
                  const rawVal = card[row.key]
                  const formatted = row.format(rawVal)

                  let isBest = false
                  if (row.key === 'travel_insurance') {
                    isBest = rawVal != null && typeof rawVal === 'object' && Object.keys(rawVal as object).length > 0
                  } else if (bestVal != null) {
                    isBest = (rawVal as number | null) === bestVal
                  }

                  return (
                    <td
                      key={card.id}
                      className={clsx(
                        'px-4 py-3 text-center',
                        isBest
                          ? 'font-semibold text-emerald-700 bg-emerald-50'
                          : 'text-gray-600'
                      )}
                    >
                      {formatted}
                      {isBest && (
                        <span className="ml-1 text-xs text-emerald-500">★</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Calculator } from 'lucide-react'

interface Projection {
  year: number
  balance: number
  contributions: number
  interest: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

export function ScenarioModeler() {
  const [monthlySavings, setMonthlySavings] = useState<string>('')
  const [interestRate, setInterestRate] = useState<string>('')
  const [years, setYears] = useState<string>('')
  const [projections, setProjections] = useState<Projection[]>([])

  function calculate() {
    const monthly = parseFloat(monthlySavings)
    const rate = parseFloat(interestRate) / 100
    const numYears = parseInt(years, 10)

    if (isNaN(monthly) || isNaN(rate) || isNaN(numYears) || numYears <= 0) return

    const results: Projection[] = []
    let balance = 0
    let totalContributions = 0

    for (let y = 1; y <= numYears; y++) {
      const yearlyContribution = monthly * 12
      totalContributions += yearlyContribution
      const interestEarned = (balance + yearlyContribution) * rate
      balance = balance + yearlyContribution + interestEarned

      results.push({
        year: y,
        balance: Math.round(balance * 100) / 100,
        contributions: Math.round(totalContributions * 100) / 100,
        interest: Math.round((balance - totalContributions) * 100) / 100,
      })
    }

    setProjections(results)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-gray-400" />
          <CardTitle className="text-base">Savings Scenario Modeler</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Savings (ZAR)
            </label>
            <Input
              type="number"
              placeholder="e.g. 5000"
              value={monthlySavings}
              onChange={(e) => setMonthlySavings(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Annual Interest Rate (%)
            </label>
            <Input
              type="number"
              placeholder="e.g. 8"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Years
            </label>
            <Input
              type="number"
              placeholder="e.g. 10"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={calculate}>Calculate</Button>

        {projections.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Year</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-600">Contributions</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-600">Interest Earned</th>
                  <th className="text-right py-2 pl-4 font-medium text-gray-600">Total Balance</th>
                </tr>
              </thead>
              <tbody>
                {projections.map((row) => (
                  <tr key={row.year} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4 text-gray-700">{row.year}</td>
                    <td className="py-2 px-4 text-right text-gray-600">
                      {formatCurrency(row.contributions)}
                    </td>
                    <td className="py-2 px-4 text-right text-green-700">
                      {formatCurrency(row.interest)}
                    </td>
                    <td className="py-2 pl-4 text-right font-medium text-gray-900">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

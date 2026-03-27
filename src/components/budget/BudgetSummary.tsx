import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface SummaryData {
  total_income: number
  total_expenses: number
  month: string
}

export function BudgetSummary({ summary }: { summary: SummaryData | null }) {
  const income = Number(summary?.total_income ?? 0)
  const expenses = Number(summary?.total_expenses ?? 0)
  const net = income - expenses

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500">Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <span className="text-2xl font-bold text-green-600">R {income.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500">Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600">R {expenses.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500">Net</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Minus className="h-5 w-5 text-gray-500" />
            <span className={`text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R {net.toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useRouter } from 'next/navigation'
import type { BudgetTransaction, BudgetCategory } from '@/types'

export function TransactionList({
  transactions,
  categories,
}: {
  transactions: BudgetTransaction[]
  categories: BudgetCategory[]
}) {
  const [filter, setFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [isIncome, setIsIncome] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const router = useRouter()

  const filtered = transactions.filter(
    (t) =>
      t.description.toLowerCase().includes(filter.toLowerCase()) ||
      (t.category ?? '').toLowerCase().includes(filter.toLowerCase())
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/budget/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        amount: parseFloat(amount),
        is_income: isIncome,
        transaction_date: date,
        source: 'manual',
      }),
    })
    setDescription('')
    setAmount('')
    setShowAdd(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter transactions..."
          className="max-w-xs"
        />
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add transaction'}
        </Button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 border-b border-gray-100 grid grid-cols-2 md:grid-cols-5 gap-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" required />
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isIncome} onChange={(e) => setIsIncome(e.target.checked)} />
            Income
          </label>
          <Button type="submit" size="sm">Save</Button>
        </form>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No transactions found.</div>
        ) : (
          filtered.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                <p className="text-xs text-gray-500">
                  {new Date(tx.transaction_date).toLocaleDateString()}
                  {tx.category && <> &middot; {tx.category}</>}
                  {tx.source !== 'manual' && (
                    <Badge variant="secondary" className="ml-2">{tx.source}</Badge>
                  )}
                </p>
              </div>
              <span className={`font-medium ${tx.is_income ? 'text-green-600' : 'text-red-600'}`}>
                {tx.is_income ? '+' : '-'}R {Number(tx.amount).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ShoppingCart, Plus } from 'lucide-react'

interface GroceryPurchase {
  id: string
  retailer: string
  purchase_date: string
  total_amount: number
  currency: string
  items: unknown[] | null
  receipt_id: string | null
  created_at: string
}

export function PurchaseHistory({ purchases: initial }: { purchases: GroceryPurchase[] }) {
  const [purchases, setPurchases] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [retailer, setRetailer] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')

  // Group by retailer
  const grouped = purchases.reduce<Record<string, GroceryPurchase[]>>((acc, p) => {
    const key = p.retailer
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!retailer || !purchaseDate || !totalAmount) return
    setSaving(true)

    try {
      const res = await fetch('/api/grocery/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailer,
          purchase_date: purchaseDate,
          total_amount: parseFloat(totalAmount),
        }),
      })

      if (res.ok) {
        const newPurchase = await res.json()
        setPurchases([newPurchase, ...purchases])
        setRetailer('')
        setPurchaseDate('')
        setTotalAmount('')
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Purchase History
        </h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Purchase
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Retailer"
                  value={retailer}
                  onChange={(e) => setRetailer(e.target.value)}
                  required
                />
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Total Amount"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Purchase'}
                </Button>
                <Button type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {Object.keys(grouped).length === 0 ? (
        <p className="text-gray-500 text-sm">No purchases recorded yet.</p>
      ) : (
        Object.entries(grouped).map(([store, items]) => (
          <Card key={store}>
            <CardHeader>
              <CardTitle className="text-base">{store}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-6 py-3 text-sm">
                    <span className="text-gray-700">
                      {new Date(p.purchase_date).toLocaleDateString('en-ZA')}
                    </span>
                    <Badge variant="default">
                      {p.currency} {p.total_amount.toFixed(2)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

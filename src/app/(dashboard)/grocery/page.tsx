import { createClient } from '@/lib/supabase/server'
import { PurchaseHistory } from '@/components/grocery/PurchaseHistory'
import { DepletionTracker } from '@/components/grocery/DepletionTracker'
import { ShoppingBasket } from 'lucide-react'

export default async function GroceryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const { data: purchases } = await supabase
    .from('grocery_purchases')
    .select('*')
    .eq('household_id', householdId)
    .order('purchase_date', { ascending: false })

  const { data: items } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('household_id', householdId)
    .order('predicted_next_purchase', { ascending: true })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ShoppingBasket className="h-6 w-6 text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">Grocery Intelligence</h1>
      </div>

      <DepletionTracker items={items ?? []} />
      <PurchaseHistory purchases={purchases ?? []} />
    </div>
  )
}

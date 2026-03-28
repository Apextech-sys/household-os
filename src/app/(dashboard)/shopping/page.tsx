import { createClient } from '@/lib/supabase/server'
import { PriceWatchList } from '@/components/shopping/PriceWatchList'
import { ShoppingCart } from 'lucide-react'

export default async function ShoppingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: watches } = await supabase
    .from('price_watches')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Shopping Intelligence</h1>
      </div>

      <PriceWatchList watches={watches ?? []} />
    </div>
  )
}

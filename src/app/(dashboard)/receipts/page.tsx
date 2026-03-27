import { createClient } from '@/lib/supabase/server'
import { ReceiptGrid } from '@/components/receipts/ReceiptGrid'
import { ReceiptUpload } from '@/components/receipts/ReceiptUpload'

export default async function ReceiptsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
      <ReceiptUpload />
      <ReceiptGrid receipts={receipts ?? []} />
    </div>
  )
}

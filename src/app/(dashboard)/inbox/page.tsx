import { createClient } from '@/lib/supabase/server'
import { InboxList } from '@/components/inbox/InboxList'
import { AddressManager } from '@/components/inbox/AddressManager'

export default async function InboxPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const householdId = profile?.household_id

  const [messagesResult, addressesResult] = await Promise.all([
    householdId
      ? supabase
          .from('inbox_messages')
          .select('*, inbox_addresses(label, email_address)')
          .eq('household_id', householdId)
          .order('received_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('inbox_addresses')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
      <AddressManager addresses={addressesResult.data ?? []} />
      <InboxList messages={messagesResult.data ?? []} />
    </div>
  )
}

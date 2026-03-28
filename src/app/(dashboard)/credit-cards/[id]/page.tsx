import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProtectionTimeline } from '@/components/credit-cards/ProtectionTimeline'
import { notFound } from 'next/navigation'
import { CreditCard, ShieldCheck, RotateCcw, Plane, Banknote } from 'lucide-react'

export default async function CreditCardDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: card } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('id', params.id)
    .eq('household_id', profile?.household_id)
    .single()

  if (!card) return notFound()

  const { data: protections } = await supabase
    .from('purchase_protections')
    .select('*')
    .eq('credit_card_id', params.id)
    .order('protection_expiry', { ascending: true })

  const activeCount = (protections ?? []).filter((p: any) => p.status === 'active').length

  const travelKeys = card.travel_insurance ? Object.keys(card.travel_insurance) : []
  const hasTravelInsurance = travelKeys.length > 0

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <CreditCard className="w-7 h-7 text-gray-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{card.card_name}</h1>
          <p className="text-sm text-gray-500">{card.card_type}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Card Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-gray-500">Card Name</dt>
              <dd className="font-medium">{card.card_name}</dd>
              <dt className="text-gray-500">Card Type</dt>
              <dd>{card.card_type}</dd>
              <dt className="text-gray-500">Annual Fee</dt>
              <dd className="font-medium">
                {card.annual_fee != null ? `R ${Number(card.annual_fee).toFixed(2)}` : 'Free'}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Benefits Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Purchase Protection</p>
                  <p className="text-gray-500">
                    {card.purchase_protection_days != null
                      ? `${card.purchase_protection_days} days coverage`
                      : 'Not included'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <RotateCcw className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Warranty Extension</p>
                  <p className="text-gray-500">
                    {card.warranty_extension_months != null
                      ? `+${card.warranty_extension_months} months`
                      : 'Not included'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <Plane className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Travel Insurance</p>
                  {hasTravelInsurance ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {travelKeys.map((k) => (
                        <Badge key={k} variant="default" className="text-xs capitalize">{k.replace(/_/g, ' ')}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Not included</p>
                  )}
                </div>
              </div>

              {card.benefits && Object.keys(card.benefits).length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <Banknote className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-gray-700">Additional Benefits</p>
                    <ul className="mt-1 space-y-1">
                      {Object.entries(card.benefits as Record<string, unknown>).map(([k, v]) => (
                        <li key={k} className="text-gray-500 text-xs">
                          <span className="capitalize font-medium">{k.replace(/_/g, ' ')}</span>: {String(v)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Purchase Protections</h2>
          {activeCount > 0 && (
            <Badge variant="success">{activeCount} active</Badge>
          )}
        </div>
        <ProtectionTimeline protections={protections ?? []} />
      </div>
    </div>
  )
}

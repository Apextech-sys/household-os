import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BenefitMatrix } from '@/components/credit-cards/BenefitMatrix'
import { CreditCard } from 'lucide-react'
import Link from 'next/link'

export default async function CreditCardsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('household_id')
    .eq('id', user.id)
    .single()

  const { data: cards } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('created_at', { ascending: false })

  const cardList = cards ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Credit Cards</h1>
        <Badge variant="secondary">{cardList.length} card{cardList.length !== 1 ? 's' : ''}</Badge>
      </div>

      {cardList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
            <CreditCard className="w-12 h-12" />
            <p className="text-sm">No credit cards added yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cardList.map((card: any) => (
            <Link key={card.id} href={`/credit-cards/${card.id}`} className="block group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <CardTitle className="truncate">{card.card_name}</CardTitle>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{card.card_type}</p>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-gray-500">Annual Fee</dt>
                    <dd className="text-right font-medium">
                      {card.annual_fee != null ? `R ${Number(card.annual_fee).toFixed(2)}` : 'Free'}
                    </dd>
                    <dt className="text-gray-500">Purchase Protection</dt>
                    <dd className="text-right">
                      {card.purchase_protection_days != null ? `${card.purchase_protection_days} days` : '—'}
                    </dd>
                    <dt className="text-gray-500">Warranty Extension</dt>
                    <dd className="text-right">
                      {card.warranty_extension_months != null ? `+${card.warranty_extension_months} mo` : '—'}
                    </dd>
                    <dt className="text-gray-500">Travel Insurance</dt>
                    <dd className="text-right">
                      {card.travel_insurance && Object.keys(card.travel_insurance).length > 0 ? (
                        <Badge variant="success" className="text-xs">Included</Badge>
                      ) : '—'}
                    </dd>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {cardList.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Benefit Comparison</h2>
          <BenefitMatrix cards={cardList} />
        </div>
      )}
    </div>
  )
}

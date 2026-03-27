import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Shield } from 'lucide-react'
import type { Warranty } from '@/types'

export function WarrantyCard({ warranty }: { warranty: Warranty }) {
  const expiryDate = new Date(warranty.expiry_date)
  const now = new Date()
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const isExpired = daysLeft < 0
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Shield className={`h-5 w-5 mt-0.5 ${isExpired ? 'text-gray-400' : isExpiringSoon ? 'text-yellow-500' : 'text-green-500'}`} />
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">{warranty.product_name}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {warranty.warranty_months} months warranty
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={isExpired ? 'error' : isExpiringSoon ? 'warning' : 'success'}>
                {isExpired
                  ? 'Expired'
                  : daysLeft <= 1
                  ? 'Expires today'
                  : `${daysLeft} days left`}
              </Badge>
              <span className="text-xs text-gray-500">
                Expires {expiryDate.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

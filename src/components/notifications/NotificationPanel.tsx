import { X, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  notifications: any[]
  onClose: () => void
  onMarkRead: (id: string) => void
}

export function NotificationPanel({ notifications, onClose, onMarkRead }: Props) {
  return (
    <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 text-center">No new notifications</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="p-3 border-b border-gray-50 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-1">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => onMarkRead(n.id)}
                  className="p-1 hover:bg-gray-200 rounded ml-2"
                  title="Mark as read"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

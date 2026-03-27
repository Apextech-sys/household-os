import { ChatInterface } from '@/components/chat/ChatInterface'

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>
      <div className="flex-1 min-h-0">
        <ChatInterface />
      </div>
    </div>
  )
}

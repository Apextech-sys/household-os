'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Send } from 'lucide-react'

function getTextContent(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
}

export function DocumentChat({ documentId }: { documentId: string }) {
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/documents/${documentId}/qa`,
      body: sessionId ? { session_id: sessionId } : {},
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader>
        <CardTitle>Ask about this document</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              Ask a question about this document...
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm p-3 rounded-lg ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white ml-8'
                  : 'bg-gray-100 text-gray-900 mr-8'
              }`}
            >
              {getTextContent(m.parts as { type: string; text?: string }[])}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
